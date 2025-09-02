const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const config = require('../config/config');
const { Host, SSHSession, AuditLog } = require('../models');

/**
 * SSH连接管理器
 */
class SSHConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // 存储活动连接
    this.connectionPool = new Map(); // 连接池
    this.maxConnections = config.ssh.maxConnections || 100;
    this.connectionTimeout = config.ssh.timeout || 30000;
    this.keepAliveInterval = config.ssh.keepAliveInterval || 30000;
    
    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 创建SSH连接
   */
  async connect(hostId, authInfo, clientInfo = {}) {
    try {
      logger.ssh('尝试建立SSH连接', { hostId, authType: authInfo.type });

      // 获取主机信息
      const hostModel = new Host();
      const host = await hostModel.findById(hostId);
      
      if (!host) {
        throw new Error('主机不存在');
      }

      // 检查连接数限制
      if (this.connections.size >= this.maxConnections) {
        throw new Error('已达到最大连接数限制');
      }

      // 创建SSH客户端
      const conn = new Client();
      const sessionToken = this.generateSessionToken();
      
      // 连接配置
      const connectOptions = {
        host: host.hostname,
        port: host.port || 22,
        username: host.username,
        readyTimeout: this.connectionTimeout,
        keepaliveInterval: this.keepAliveInterval,
        keepaliveCountMax: 3
      };

      // 根据认证类型设置认证信息
      if (authInfo.type === 'password') {
        connectOptions.password = authInfo.password;
      } else if (authInfo.type === 'key') {
        if (authInfo.privateKey) {
          connectOptions.privateKey = authInfo.privateKey;
        } else if (authInfo.privateKeyPath) {
          connectOptions.privateKey = fs.readFileSync(authInfo.privateKeyPath);
        }
        
        if (authInfo.passphrase) {
          connectOptions.passphrase = authInfo.passphrase;
        }
      }

      // 建立连接
      const connectionInfo = await new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('连接超时'));
        }, this.connectionTimeout);

        conn.on('ready', async () => {
          clearTimeout(connectionTimeout);
          
          try {
            // 更新主机连接状态
            await hostModel.updateConnectionStatus(hostId, 'connected');
            
            // 创建会话记录
            const sessionModel = new SSHSession();
            const session = await sessionModel.createSession(hostId, sessionToken, clientInfo);
            
            // 记录审计日志
            const auditModel = new AuditLog();
            await auditModel.log({
              hostId,
              sessionId: session.id,
              action: 'ssh_connect',
              category: 'ssh',
              status: 'success',
              riskLevel: 'low',
              ipAddress: clientInfo.ip,
              userAgent: clientInfo.userAgent,
              metadata: {
                hostname: host.hostname,
                username: host.username,
                authType: authInfo.type
              }
            });

            const connectionData = {
              id: sessionToken,
              hostId,
              sessionId: session.id,
              connection: conn,
              host,
              connectedAt: new Date(),
              lastActivity: new Date(),
              status: 'connected',
              clientInfo
            };

            this.connections.set(sessionToken, connectionData);
            
            logger.ssh('SSH连接成功', { 
              hostId, 
              sessionToken,
              hostname: host.hostname 
            });

            resolve(connectionData);
          } catch (error) {
            reject(error);
          }
        });

        conn.on('error', async (err) => {
          clearTimeout(connectionTimeout);
          
          // 更新主机状态
          await hostModel.updateConnectionStatus(hostId, 'error');
          
          // 记录审计日志
          const auditModel = new AuditLog();
          await auditModel.log({
            hostId,
            action: 'ssh_connect_failed',
            category: 'ssh',
            status: 'failed',
            riskLevel: 'medium',
            ipAddress: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            metadata: {
              hostname: host.hostname,
              username: host.username,
              error: err.message
            }
          });

          logger.ssh('SSH连接失败', { hostId, error: err.message });
          reject(err);
        });

        conn.on('close', () => {
          logger.ssh('SSH连接关闭', { hostId, sessionToken });
          this.handleConnectionClose(sessionToken);
        });

        conn.connect(connectOptions);
      });

      this.emit('connected', connectionInfo);
      return connectionInfo;

    } catch (error) {
      logger.error('SSH连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开SSH连接
   */
  async disconnect(sessionToken, reason = 'user_request') {
    try {
      const connectionInfo = this.connections.get(sessionToken);
      
      if (!connectionInfo) {
        throw new Error('连接不存在');
      }

      // 关闭SSH连接
      connectionInfo.connection.end();
      
      // 更新会话状态
      const sessionModel = new SSHSession();
      await sessionModel.terminateSession(sessionToken, reason);
      
      // 更新主机状态
      const hostModel = new Host();
      await hostModel.updateConnectionStatus(connectionInfo.hostId, 'disconnected');
      
      // 记录审计日志
      const auditModel = new AuditLog();
      await auditModel.log({
        hostId: connectionInfo.hostId,
        sessionId: connectionInfo.sessionId,
        action: 'ssh_disconnect',
        category: 'ssh',
        status: 'success',
        riskLevel: 'low',
        ipAddress: connectionInfo.clientInfo.ip,
        metadata: {
          hostname: connectionInfo.host.hostname,
          reason,
          duration: Date.now() - connectionInfo.connectedAt.getTime()
        }
      });

      // 从连接池中移除
      this.connections.delete(sessionToken);
      
      logger.ssh('SSH连接已断开', { 
        sessionToken, 
        hostId: connectionInfo.hostId,
        reason 
      });

      this.emit('disconnected', connectionInfo);
      return true;

    } catch (error) {
      logger.error('断开SSH连接失败:', error);
      throw error;
    }
  }

  /**
   * 执行SSH命令
   */
  async executeCommand(sessionToken, command, options = {}) {
    try {
      const connectionInfo = this.connections.get(sessionToken);
      
      if (!connectionInfo) {
        throw new Error('连接不存在');
      }

      // 更新活动时间
      connectionInfo.lastActivity = new Date();
      
      // 更新会话活动时间
      const sessionModel = new SSHSession();
      await sessionModel.updateActivity(sessionToken);

      logger.ssh('执行SSH命令', { 
        sessionToken, 
        command: options.sensitive ? '[HIDDEN]' : command 
      });

      const result = await new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        
        connectionInfo.connection.exec(command, {
          pty: options.pty || false,
          env: options.env || {}
        }, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          stream.on('close', (code, signal) => {
            const result = {
              command,
              stdout,
              stderr,
              exitCode: code,
              signal,
              timestamp: new Date().toISOString()
            };

            // 记录审计日志
            this.logCommandExecution(connectionInfo, command, result, options);
            
            resolve(result);
          });

          stream.on('data', (data) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          // 如果有输入数据，写入stream
          if (options.input) {
            stream.write(options.input);
          }
          
          // 结束输入
          if (!options.keepAlive) {
            stream.end();
          }
        });
      });

      return result;

    } catch (error) {
      logger.error('执行SSH命令失败:', error);
      throw error;
    }
  }

  /**
   * 创建SSH shell
   */
  async createShell(sessionToken, options = {}) {
    try {
      const connectionInfo = this.connections.get(sessionToken);
      
      if (!connectionInfo) {
        throw new Error('连接不存在');
      }

      logger.ssh('创建SSH Shell', { sessionToken });

      const shell = await new Promise((resolve, reject) => {
        connectionInfo.connection.shell({
          cols: options.cols || 80,
          rows: options.rows || 24,
          term: options.term || 'xterm-256color'
        }, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(stream);
        });
      });

      // 记录审计日志
      const auditModel = new AuditLog();
      await auditModel.log({
        hostId: connectionInfo.hostId,
        sessionId: connectionInfo.sessionId,
        action: 'shell_created',
        category: 'ssh',
        status: 'success',
        riskLevel: 'low',
        ipAddress: connectionInfo.clientInfo.ip,
        metadata: {
          terminalType: options.term,
          size: `${options.cols}x${options.rows}`
        }
      });

      return shell;

    } catch (error) {
      logger.error('创建SSH Shell失败:', error);
      throw error;
    }
  }

  /**
   * 获取连接信息
   */
  getConnection(sessionToken) {
    return this.connections.get(sessionToken);
  }

  /**
   * 获取所有活动连接
   */
  getActiveConnections() {
    return Array.from(this.connections.values());
  }

  /**
   * 获取主机的活动连接
   */
  getHostConnections(hostId) {
    return Array.from(this.connections.values()).filter(
      conn => conn.hostId === hostId
    );
  }

  /**
   * 断开主机的所有连接
   */
  async disconnectHost(hostId, reason = 'host_maintenance') {
    const hostConnections = this.getHostConnections(hostId);
    
    const disconnectPromises = hostConnections.map(conn => 
      this.disconnect(conn.id, reason)
    );
    
    await Promise.all(disconnectPromises);
    
    logger.ssh('主机所有连接已断开', { hostId, count: hostConnections.length });
    
    return hostConnections.length;
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(reason = 'server_shutdown') {
    const allConnections = Array.from(this.connections.keys());
    
    const disconnectPromises = allConnections.map(sessionToken => 
      this.disconnect(sessionToken, reason)
    );
    
    await Promise.all(disconnectPromises);
    
    logger.ssh('所有连接已断开', { count: allConnections.length });
    
    return allConnections.length;
  }

  /**
   * 生成会话令牌
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 处理连接关闭
   */
  async handleConnectionClose(sessionToken) {
    const connectionInfo = this.connections.get(sessionToken);
    
    if (connectionInfo) {
      try {
        // 更新会话状态
        const sessionModel = new SSHSession();
        await sessionModel.terminateSession(sessionToken, 'connection_lost');
        
        // 更新主机状态
        const hostModel = new Host();
        await hostModel.updateConnectionStatus(connectionInfo.hostId, 'disconnected');
        
        // 记录审计日志
        const auditModel = new AuditLog();
        await auditModel.log({
          hostId: connectionInfo.hostId,
          sessionId: connectionInfo.sessionId,
          action: 'ssh_connection_lost',
          category: 'ssh',
          status: 'warning',
          riskLevel: 'low',
          ipAddress: connectionInfo.clientInfo.ip,
          metadata: {
            hostname: connectionInfo.host.hostname,
            duration: Date.now() - connectionInfo.connectedAt.getTime()
          }
        });
        
      } catch (error) {
        logger.error('处理连接关闭失败:', error);
      } finally {
        this.connections.delete(sessionToken);
        this.emit('connection_lost', connectionInfo);
      }
    }
  }

  /**
   * 记录命令执行审计日志
   */
  async logCommandExecution(connectionInfo, command, result, options = {}) {
    try {
      const auditModel = new AuditLog();
      
      // 确定风险等级
      let riskLevel = 'low';
      if (command.includes('sudo') || command.includes('su ')) {
        riskLevel = 'medium';
      }
      if (command.includes('rm -rf') || command.includes('format') || command.includes('mkfs')) {
        riskLevel = 'high';
      }
      
      await auditModel.log({
        hostId: connectionInfo.hostId,
        sessionId: connectionInfo.sessionId,
        action: 'command_execution',
        category: 'ssh',
        command: options.sensitive ? '[SENSITIVE_COMMAND]' : command,
        result: result.exitCode === 0 ? 'success' : 'failed',
        status: result.exitCode === 0 ? 'success' : 'failed',
        riskLevel,
        ipAddress: connectionInfo.clientInfo.ip,
        metadata: {
          exitCode: result.exitCode,
          signal: result.signal,
          outputLength: result.stdout.length + result.stderr.length,
          executionTime: new Date() - connectionInfo.lastActivity
        }
      });
    } catch (error) {
      logger.error('记录命令执行审计日志失败:', error);
    }
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    // 每分钟检查一次过期连接
    setInterval(() => {
      this.cleanupExpiredConnections();
    }, 60000);
    
    // 每小时清理一次数据库中的过期会话
    setInterval(async () => {
      try {
        const sessionModel = new SSHSession();
        const cleaned = await sessionModel.cleanupExpiredSessions(60); // 60分钟超时
        if (cleaned > 0) {
          logger.ssh('清理过期会话', { count: cleaned });
        }
      } catch (error) {
        logger.error('清理过期会话失败:', error);
      }
    }, 3600000);
  }

  /**
   * 清理过期连接
   */
  cleanupExpiredConnections() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30分钟超时
    
    for (const [sessionToken, connectionInfo] of this.connections.entries()) {
      if (now - connectionInfo.lastActivity.getTime() > timeout) {
        logger.ssh('连接超时，自动断开', { sessionToken });
        this.disconnect(sessionToken, 'timeout');
      }
    }
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats() {
    const connections = Array.from(this.connections.values());
    
    return {
      total: connections.length,
      maxConnections: this.maxConnections,
      byHost: connections.reduce((acc, conn) => {
        acc[conn.hostId] = (acc[conn.hostId] || 0) + 1;
        return acc;
      }, {}),
      oldestConnection: connections.reduce((oldest, conn) => {
        return !oldest || conn.connectedAt < oldest.connectedAt ? conn : oldest;
      }, null),
      totalUptime: connections.reduce((total, conn) => {
        return total + (Date.now() - conn.connectedAt.getTime());
      }, 0)
    };
  }
}

// 创建全局SSH连接管理器实例
const sshManager = new SSHConnectionManager();

module.exports = sshManager;