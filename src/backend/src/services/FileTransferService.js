const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const database = require('../utils/database');
const AuthService = require('./AuthService');

/**
 * 文件传输服务
 * 支持SFTP、FTP、SCP协议的文件传输
 */
class FileTransferService extends EventEmitter {
  constructor() {
    super();
    this.activeTransfers = new Map(); // 活动传输任务
    this.sftpConnections = new Map(); // SFTP连接池
    this.maxConcurrentTransfers = 5; // 最大并发传输数
    this.chunkSize = 64 * 1024; // 64KB 分块大小
    this.transferTimeout = 30 * 60 * 1000; // 30分钟超时
  }

  /**
   * 开始文件上传
   */
  async uploadFile(hostId, localPath, remotePath, options = {}) {
    try {
      logger.info('开始文件上传:', { hostId, localPath, remotePath });
      
      // 检查本地文件
      const localStats = await fs.stat(localPath);
      if (!localStats.isFile()) {
        throw new Error('本地路径不是文件');
      }
      
      // 创建传输记录
      const transfer = await this.createTransferRecord({
        hostId,
        type: 'upload',
        protocol: options.protocol || 'sftp',
        localPath,
        remotePath,
        fileName: path.basename(localPath),
        fileSize: localStats.size
      });
      
      // 启动传输
      const result = await this.executeTransfer(transfer, options);
      
      return result;
      
    } catch (error) {
      logger.error('文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 开始文件下载
   */
  async downloadFile(hostId, remotePath, localPath, options = {}) {
    try {
      logger.info('开始文件下载:', { hostId, remotePath, localPath });
      
      // 创建传输记录
      const transfer = await this.createTransferRecord({
        hostId,
        type: 'download',
        protocol: options.protocol || 'sftp',
        localPath,
        remotePath,
        fileName: path.basename(remotePath),
        fileSize: 0 // 下载时文件大小将在连接后获取
      });
      
      // 启动传输
      const result = await this.executeTransfer(transfer, options);
      
      return result;
      
    } catch (error) {
      logger.error('文件下载失败:', error);
      throw error;
    }
  }

  /**
   * 批量文件传输
   */
  async batchTransfer(hostId, transfers, options = {}) {
    try {
      logger.info('开始批量文件传输:', { hostId, count: transfers.length });
      
      if (transfers.length > this.maxConcurrentTransfers) {
        throw new Error(`批量传输数量不能超过${this.maxConcurrentTransfers}个`);
      }
      
      const results = [];
      
      // 并发执行传输任务
      const promises = transfers.map(async (transfer) => {
        try {
          let result;
          
          if (transfer.type === 'upload') {
            result = await this.uploadFile(hostId, transfer.localPath, transfer.remotePath, options);
          } else if (transfer.type === 'download') {
            result = await this.downloadFile(hostId, transfer.remotePath, transfer.localPath, options);
          }
          
          return { ...transfer, success: true, result };
          
        } catch (error) {
          return { ...transfer, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.allSettled(promises);
      
      for (let i = 0; i < batchResults.length; i++) {
        const promiseResult = batchResults[i];
        
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          results.push({
            ...transfers[i],
            success: false,
            error: promiseResult.reason.message
          });
        }
      }
      
      return {
        success: true,
        results,
        total: transfers.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      };
      
    } catch (error) {
      logger.error('批量传输失败:', error);
      throw error;
    }
  }

  /**
   * 执行传输任务
   */
  async executeTransfer(transfer, options = {}) {
    return new Promise(async (resolve, reject) => {
      let sftpConnection = null;
      let transferTimeout = null;
      
      try {
        // 设置超时
        transferTimeout = setTimeout(() => {
          reject(new Error('传输超时'));
        }, this.transferTimeout);
        
        // 获取认证信息
        const authInfo = await AuthService.getSavedAuthInfo(transfer.hostId);
        if (!authInfo) {
          throw new Error('未找到主机认证信息');
        }
        
        // 建立SFTP连接
        sftpConnection = await this.createSFTPConnection(transfer.hostId, authInfo);
        
        // 更新传输状态
        await this.updateTransferStatus(transfer.id, 'transferring', {
          startedAt: new Date()
        });
        
        let result;
        
        if (transfer.type === 'upload') {
          result = await this.performUpload(sftpConnection, transfer, options);
        } else if (transfer.type === 'download') {
          result = await this.performDownload(sftpConnection, transfer, options);
        }
        
        // 计算文件校验和
        if (options.checksum && result.success) {
          const checksum = await this.calculateChecksum(
            transfer.type === 'upload' ? transfer.localPath : transfer.localPath
          );
          result.checksum = checksum;
          
          // 更新数据库记录
          await database.run(
            'UPDATE file_transfers SET checksum = ? WHERE id = ?',
            [checksum, transfer.id]
          );
        }
        
        // 更新完成状态
        await this.updateTransferStatus(transfer.id, 'completed', {
          completedAt: new Date(),
          transferredSize: result.transferredSize,
          transferSpeed: result.averageSpeed
        });
        
        clearTimeout(transferTimeout);
        resolve(result);
        
      } catch (error) {
        logger.error('传输执行失败:', error);
        
        // 更新失败状态
        await this.updateTransferStatus(transfer.id, 'failed', {
          errorMessage: error.message
        });
        
        if (transferTimeout) {
          clearTimeout(transferTimeout);
        }
        
        reject(error);
      } finally {
        // 清理连接
        if (sftpConnection) {
          try {
            sftpConnection.sftp.end();
            sftpConnection.conn.end();
          } catch (error) {
            logger.warn('关闭SFTP连接失败:', error);
          }
        }
        
        // 从活动传输中移除
        this.activeTransfers.delete(transfer.id);
      }
    });
  }

  /**
   * 执行上传
   */
  async performUpload(sftpConnection, transfer, options = {}) {
    const { sftp } = sftpConnection;
    const startTime = Date.now();
    let transferredSize = 0;
    
    return new Promise((resolve, reject) => {
      // 创建读取流
      const readStream = require('fs').createReadStream(transfer.localPath);
      
      // 创建写入流
      const writeStream = sftp.createWriteStream(transfer.remotePath, {
        flags: 'w',
        encoding: null
      });
      
      // 监听进度
      readStream.on('data', (chunk) => {
        transferredSize += chunk.length;
        
        const progress = (transferredSize / transfer.fileSize) * 100;
        const elapsed = Date.now() - startTime;
        const speed = elapsed > 0 ? transferredSize / (elapsed / 1000) : 0;
        
        // 发送进度事件
        this.emit('progress', {
          transferId: transfer.id,
          transferred: transferredSize,
          total: transfer.fileSize,
          progress: progress.toFixed(2),
          speed,
          elapsed
        });
        
        // 更新数据库进度
        database.run(
          'UPDATE file_transfers SET transferred_size = ?, transfer_speed = ? WHERE id = ?',
          [transferredSize, speed, transfer.id]
        ).catch(err => logger.warn('更新传输进度失败:', err));
      });
      
      // 处理错误
      readStream.on('error', reject);
      writeStream.on('error', reject);
      
      // 完成处理
      writeStream.on('close', () => {
        const elapsed = Date.now() - startTime;
        const averageSpeed = elapsed > 0 ? transferredSize / (elapsed / 1000) : 0;
        
        resolve({
          success: true,
          transferredSize,
          totalSize: transfer.fileSize,
          elapsed,
          averageSpeed,
          progress: 100
        });
      });
      
      // 开始传输
      readStream.pipe(writeStream);
    });
  }

  /**
   * 执行下载
   */
  async performDownload(sftpConnection, transfer, options = {}) {
    const { sftp } = sftpConnection;
    const startTime = Date.now();
    let transferredSize = 0;
    
    return new Promise(async (resolve, reject) => {
      try {
        // 获取远程文件信息
        const remoteStats = await new Promise((resolve, reject) => {
          sftp.stat(transfer.remotePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats);
          });
        });
        
        const fileSize = remoteStats.size;
        
        // 更新数据库文件大小
        await database.run(
          'UPDATE file_transfers SET file_size = ? WHERE id = ?',
          [fileSize, transfer.id]
        );
        
        // 创建读取流
        const readStream = sftp.createReadStream(transfer.remotePath);
        
        // 创建写入流
        const writeStream = require('fs').createWriteStream(transfer.localPath);
        
        // 监听进度
        readStream.on('data', (chunk) => {
          transferredSize += chunk.length;
          
          const progress = (transferredSize / fileSize) * 100;
          const elapsed = Date.now() - startTime;
          const speed = elapsed > 0 ? transferredSize / (elapsed / 1000) : 0;
          
          // 发送进度事件
          this.emit('progress', {
            transferId: transfer.id,
            transferred: transferredSize,
            total: fileSize,
            progress: progress.toFixed(2),
            speed,
            elapsed
          });
          
          // 更新数据库进度
          database.run(
            'UPDATE file_transfers SET transferred_size = ?, transfer_speed = ? WHERE id = ?',
            [transferredSize, speed, transfer.id]
          ).catch(err => logger.warn('更新传输进度失败:', err));
        });
        
        // 处理错误
        readStream.on('error', reject);
        writeStream.on('error', reject);
        
        // 完成处理
        writeStream.on('close', () => {
          const elapsed = Date.now() - startTime;
          const averageSpeed = elapsed > 0 ? transferredSize / (elapsed / 1000) : 0;
          
          resolve({
            success: true,
            transferredSize,
            totalSize: fileSize,
            elapsed,
            averageSpeed,
            progress: 100
          });
        });
        
        // 开始传输
        readStream.pipe(writeStream);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 创建SFTP连接
   */
  async createSFTPConnection(hostId, authInfo) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const host = database.get('SELECT * FROM hosts WHERE id = ?', [hostId])
        .then(host => {
          if (!host) {
            throw new Error('主机不存在');
          }
          
          const connectOptions = {
            host: host.hostname,
            port: host.port || 22,
            username: host.username,
            readyTimeout: 30000
          };
          
          // 设置认证信息
          if (authInfo.authType === 'password' && authInfo.password) {
            connectOptions.password = authInfo.password;
          } else if (authInfo.authType === 'key' && authInfo.privateKey) {
            connectOptions.privateKey = authInfo.privateKey;
            if (authInfo.passphrase) {
              connectOptions.passphrase = authInfo.passphrase;
            }
          }
          
          conn.on('ready', () => {
            conn.sftp((err, sftp) => {
              if (err) {
                reject(err);
                return;
              }
              
              logger.info('SFTP连接已建立:', hostId);
              resolve({ conn, sftp });
            });
          });
          
          conn.on('error', (err) => {
            logger.error('SFTP连接失败:', err);
            reject(err);
          });
          
          conn.connect(connectOptions);
        })
        .catch(reject);
    });
  }

  /**
   * 创建传输记录
   */
  async createTransferRecord(transferData) {
    const transferId = this.generateTransferId();
    
    const result = await database.run(`
      INSERT INTO file_transfers (
        id, host_id, type, protocol, local_path, remote_path, 
        file_name, file_size, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transferId,
      transferData.hostId,
      transferData.type,
      transferData.protocol,
      transferData.localPath,
      transferData.remotePath,
      transferData.fileName,
      transferData.fileSize,
      'pending'
    ]);
    
    const transfer = {
      id: transferId,
      ...transferData,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.activeTransfers.set(transferId, transfer);
    
    return transfer;
  }

  /**
   * 更新传输状态
   */
  async updateTransferStatus(transferId, status, additionalData = {}) {
    try {
      const updateFields = ['status = ?'];
      const updateValues = [status];
      
      if (additionalData.startedAt) {
        updateFields.push('started_at = ?');
        updateValues.push(additionalData.startedAt.toISOString());
      }
      
      if (additionalData.completedAt) {
        updateFields.push('completed_at = ?');
        updateValues.push(additionalData.completedAt.toISOString());
      }
      
      if (additionalData.transferredSize !== undefined) {
        updateFields.push('transferred_size = ?');
        updateValues.push(additionalData.transferredSize);
      }
      
      if (additionalData.transferSpeed !== undefined) {
        updateFields.push('transfer_speed = ?');
        updateValues.push(additionalData.transferSpeed);
      }
      
      if (additionalData.errorMessage) {
        updateFields.push('error_message = ?');
        updateValues.push(additionalData.errorMessage);
      }
      
      updateValues.push(transferId);
      
      await database.run(
        `UPDATE file_transfers SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      
      // 更新内存中的记录
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        transfer.status = status;
        Object.assign(transfer, additionalData);
      }
      
    } catch (error) {
      logger.error('更新传输状态失败:', error);
    }
  }

  /**
   * 计算文件校验和
   */
  async calculateChecksum(filePath, algorithm = 'md5') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = require('fs').createReadStream(filePath);
      
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * 暂停传输
   */
  async pauseTransfer(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        // 实际暂停逻辑需要根据具体传输实现
        await this.updateTransferStatus(transferId, 'paused');
        
        logger.info('传输已暂停:', transferId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('暂停传输失败:', error);
      throw error;
    }
  }

  /**
   * 恢复传输
   */
  async resumeTransfer(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (transfer && transfer.status === 'paused') {
        // 实际恢复逻辑需要根据具体传输实现
        await this.updateTransferStatus(transferId, 'transferring');
        
        logger.info('传输已恢复:', transferId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('恢复传输失败:', error);
      throw error;
    }
  }

  /**
   * 取消传输
   */
  async cancelTransfer(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        await this.updateTransferStatus(transferId, 'cancelled');
        
        // 清理资源
        this.activeTransfers.delete(transferId);
        
        logger.info('传输已取消:', transferId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('取消传输失败:', error);
      throw error;
    }
  }

  /**
   * 获取传输状态
   */
  getTransferStatus(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    return transfer || null;
  }

  /**
   * 获取所有活动传输
   */
  getActiveTransfers() {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * 获取传输历史
   */
  async getTransferHistory(hostId = null, limit = 50, offset = 0) {
    try {
      let query = 'SELECT * FROM file_transfers';
      const params = [];
      
      if (hostId) {
        query += ' WHERE host_id = ?';
        params.push(hostId);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const transfers = await database.query(query, params);
      
      return transfers;
      
    } catch (error) {
      logger.error('获取传输历史失败:', error);
      throw error;
    }
  }

  /**
   * 生成传输ID
   */
  generateTransferId() {
    return 'transfer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清理过期传输记录
   */
  async cleanupExpiredTransfers(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const result = await database.run(
        'DELETE FROM file_transfers WHERE status IN ("completed", "failed", "cancelled") AND created_at < ?',
        [cutoffDate.toISOString()]
      );
      
      logger.info('清理过期传输记录:', result.changes);
      return result.changes;
      
    } catch (error) {
      logger.error('清理传输记录失败:', error);
      throw error;
    }
  }
}

module.exports = new FileTransferService();