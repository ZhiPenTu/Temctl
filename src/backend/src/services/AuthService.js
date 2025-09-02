const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Client } = require('ssh2');
const logger = require('../utils/logger');
const cryptoUtils = require('../utils/crypto');
const database = require('../utils/database');

/**
 * 认证服务
 * 处理SSH密码和密钥认证
 */
class AuthService {
  constructor() {
    this.keyStorePath = path.join(process.env.HOME || process.env.USERPROFILE, '.temctl', 'keys');
    this.ensureKeyStoreDirectory();
  }

  /**
   * 确保密钥存储目录存在
   */
  async ensureKeyStoreDirectory() {
    try {
      await fs.mkdir(this.keyStorePath, { recursive: true, mode: 0o700 });
    } catch (error) {
      logger.error('创建密钥存储目录失败:', error);
    }
  }

  /**
   * 密码认证
   */
  async authenticateWithPassword(hostId, password, options = {}) {
    try {
      logger.info('开始密码认证:', hostId);
      
      // 获取主机信息
      const host = await database.get('SELECT * FROM hosts WHERE id = ?', [hostId]);
      if (!host) {
        throw new Error('主机不存在');
      }
      
      // 测试SSH连接
      const testResult = await this.testSSHConnection(host, {
        type: 'password',
        password
      });
      
      if (!testResult.success) {
        throw new Error(testResult.error);
      }
      
      // 如果需要保存密码
      if (options.savePassword) {
        await this.savePassword(hostId, password);
      }
      
      // 记录认证成功
      await this.logAuthEvent(hostId, 'password', 'success', {
        saved: options.savePassword || false
      });
      
      return {
        success: true,
        authType: 'password',
        hostId,
        message: '密码认证成功'
      };
      
    } catch (error) {
      logger.error('密码认证失败:', error);
      
      // 记录认证失败
      await this.logAuthEvent(hostId, 'password', 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * 密钥认证
   */
  async authenticateWithKey(hostId, keyData, options = {}) {
    try {
      logger.info('开始密钥认证:', hostId);
      
      // 获取主机信息
      const host = await database.get('SELECT * FROM hosts WHERE id = ?', [hostId]);
      if (!host) {
        throw new Error('主机不存在');
      }
      
      let privateKey;
      
      // 处理不同类型的密钥输入
      if (keyData.privateKeyPath) {
        // 从文件路径读取
        try {
          const keyContent = await fs.readFile(keyData.privateKeyPath, 'utf8');
          privateKey = keyContent;
        } catch (error) {
          throw new Error(`无法读取私钥文件: ${error.message}`);
        }
      } else if (keyData.privateKeyContent) {
        // 直接使用密钥内容
        privateKey = keyData.privateKeyContent;
      } else {
        throw new Error('未提供私钥文件或内容');
      }
      
      // 验证私钥格式
      if (!this.validatePrivateKey(privateKey)) {
        throw new Error('私钥格式无效');
      }
      
      // 测试SSH连接
      const testResult = await this.testSSHConnection(host, {
        type: 'key',
        privateKey,
        passphrase: keyData.passphrase
      });
      
      if (!testResult.success) {
        throw new Error(testResult.error);
      }
      
      // 如果需要保存密钥
      if (options.saveKey) {
        const keyInfo = await this.savePrivateKey(hostId, privateKey, keyData.passphrase);
        
        // 生成公钥指纹用于验证
        const publicKeyFingerprint = this.generateKeyFingerprint(privateKey);
        
        // 更新主机记录
        await database.run(
          'UPDATE hosts SET private_key_path = ?, public_key_fingerprint = ?, auth_type = ? WHERE id = ?',
          [keyInfo.keyPath, publicKeyFingerprint, 'key', hostId]
        );
      }
      
      // 记录认证成功
      await this.logAuthEvent(hostId, 'key', 'success', {
        saved: options.saveKey || false,
        hasPassphrase: !!keyData.passphrase
      });
      
      return {
        success: true,
        authType: 'key',
        hostId,
        message: '密钥认证成功'
      };
      
    } catch (error) {
      logger.error('密钥认证失败:', error);
      
      // 记录认证失败
      await this.logAuthEvent(hostId, 'key', 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * 双因子认证
   */
  async authenticateWith2FA(hostId, authData, options = {}) {
    try {
      logger.info('开始双因子认证:', hostId);
      
      // 先进行基础认证（密码或密钥）
      let baseAuth;
      if (authData.password) {
        baseAuth = await this.authenticateWithPassword(hostId, authData.password, { savePassword: false });
      } else if (authData.privateKey || authData.privateKeyPath) {
        baseAuth = await this.authenticateWithKey(hostId, authData, { saveKey: false });
      } else {
        throw new Error('双因子认证需要提供基础认证信息');
      }
      
      if (!baseAuth.success) {
        throw new Error('基础认证失败');
      }
      
      // 验证TOTP代码（如果提供）
      if (authData.totpCode) {
        const totpValid = await this.verifyTOTP(hostId, authData.totpCode);
        if (!totpValid) {
          throw new Error('TOTP验证码无效');
        }
      }
      
      // 记录2FA认证成功
      await this.logAuthEvent(hostId, '2fa', 'success', {
        baseAuthType: baseAuth.authType,
        hasTotp: !!authData.totpCode
      });
      
      return {
        success: true,
        authType: '2fa',
        hostId,
        message: '双因子认证成功'
      };
      
    } catch (error) {
      logger.error('双因子认证失败:', error);
      
      // 记录认证失败
      await this.logAuthEvent(hostId, '2fa', 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * 测试SSH连接
   */
  async testSSHConnection(host, authConfig) {
    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.end();
        resolve({ success: false, error: '连接超时' });
      }, 10000); // 10秒超时
      
      const connectOptions = {
        host: host.hostname,
        port: host.port || 22,
        username: host.username,
        readyTimeout: 5000
      };
      
      // 设置认证信息
      if (authConfig.type === 'password') {
        connectOptions.password = authConfig.password;
      } else if (authConfig.type === 'key') {
        connectOptions.privateKey = authConfig.privateKey;
        if (authConfig.passphrase) {
          connectOptions.passphrase = authConfig.passphrase;
        }
      }
      
      conn.on('ready', () => {
        clearTimeout(timeout);
        conn.end();
        resolve({ success: true });
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeout);
        let errorMessage = err.message;
        
        // 改善错误信息
        if (err.level === 'authentication') {
          errorMessage = '认证失败，请检查用户名、密码或密钥';
        } else if (err.code === 'ENOTFOUND') {
          errorMessage = '无法连接到主机，请检查主机名或IP地址';
        } else if (err.code === 'ECONNREFUSED') {
          errorMessage = '连接被拒绝，请检查端口号或SSH服务状态';
        } else if (err.code === 'ETIMEDOUT') {
          errorMessage = '连接超时，请检查网络连接';
        }
        
        resolve({ success: false, error: errorMessage });
      });
      
      conn.connect(connectOptions);
    });
  }

  /**
   * 保存加密密码
   */
  async savePassword(hostId, password) {
    try {
      const encryptedPassword = await cryptoUtils.encryptCredential(password);
      
      await database.run(
        'UPDATE hosts SET encrypted_password = ?, auth_type = ? WHERE id = ?',
        [encryptedPassword, 'password', hostId]
      );
      
      logger.info('密码已保存并加密:', hostId);
      
    } catch (error) {
      logger.error('保存密码失败:', error);
      throw error;
    }
  }

  /**
   * 保存私钥
   */
  async savePrivateKey(hostId, privateKey, passphrase) {
    try {
      // 生成唯一的密钥文件名
      const keyFileName = `${hostId}_${Date.now()}.pem`;
      const keyPath = path.join(this.keyStorePath, keyFileName);
      
      // 加密私钥内容
      const encryptedKey = await cryptoUtils.encryptCredential(privateKey);
      
      // 保存到文件（已加密）
      await fs.writeFile(keyPath, encryptedKey, { mode: 0o600 });
      
      // 如果有密码短语，也要保存
      let encryptedPassphrase = null;
      if (passphrase) {
        encryptedPassphrase = await cryptoUtils.encryptCredential(passphrase);
      }
      
      // 更新数据库记录
      await database.run(
        'UPDATE hosts SET private_key_path = ?, auth_type = ? WHERE id = ?',
        [keyPath, 'key', hostId]
      );
      
      // 如果有密码短语，保存到单独的表
      if (encryptedPassphrase) {
        await database.run(
          'INSERT OR REPLACE INTO key_passphrases (host_id, encrypted_passphrase) VALUES (?, ?)',
          [hostId, encryptedPassphrase]
        );
      }
      
      logger.info('私钥已保存并加密:', { hostId, keyPath });
      
      return { keyPath, encrypted: true };
      
    } catch (error) {
      logger.error('保存私钥失败:', error);
      throw error;
    }
  }

  /**
   * 获取保存的认证信息
   */
  async getSavedAuthInfo(hostId) {
    try {
      const host = await database.get('SELECT * FROM hosts WHERE id = ?', [hostId]);
      if (!host) {
        return null;
      }
      
      const authInfo = {
        hostId,
        authType: host.auth_type,
        username: host.username
      };
      
      if (host.auth_type === 'password' && host.encrypted_password) {
        try {
          authInfo.password = await cryptoUtils.decryptCredential(host.encrypted_password);
          authInfo.hasPassword = true;
        } catch (error) {
          logger.error('解密密码失败:', error);
          authInfo.hasPassword = false;
        }
      }
      
      if (host.auth_type === 'key' && host.private_key_path) {
        try {
          // 读取并解密私钥
          const encryptedKey = await fs.readFile(host.private_key_path, 'utf8');
          authInfo.privateKey = await cryptoUtils.decryptCredential(encryptedKey);
          authInfo.hasKey = true;
          
          // 检查是否有密码短语
          const passphraseRow = await database.get(
            'SELECT encrypted_passphrase FROM key_passphrases WHERE host_id = ?',
            [hostId]
          );
          
          if (passphraseRow) {
            authInfo.passphrase = await cryptoUtils.decryptCredential(passphraseRow.encrypted_passphrase);
            authInfo.hasPassphrase = true;
          }
          
        } catch (error) {
          logger.error('读取私钥失败:', error);
          authInfo.hasKey = false;
        }
      }
      
      return authInfo;
      
    } catch (error) {
      logger.error('获取认证信息失败:', error);
      return null;
    }
  }

  /**
   * 删除保存的认证信息
   */
  async deleteSavedAuthInfo(hostId) {
    try {
      const host = await database.get('SELECT * FROM hosts WHERE id = ?', [hostId]);
      if (!host) {
        throw new Error('主机不存在');
      }
      
      // 删除密钥文件
      if (host.private_key_path) {
        try {
          await fs.unlink(host.private_key_path);
        } catch (error) {
          logger.warn('删除密钥文件失败:', error);
        }
      }
      
      // 清理数据库记录
      await database.run(
        'UPDATE hosts SET encrypted_password = NULL, private_key_path = NULL, public_key_fingerprint = NULL WHERE id = ?',
        [hostId]
      );
      
      await database.run(
        'DELETE FROM key_passphrases WHERE host_id = ?',
        [hostId]
      );
      
      logger.info('已删除保存的认证信息:', hostId);
      
    } catch (error) {
      logger.error('删除认证信息失败:', error);
      throw error;
    }
  }

  /**
   * 验证私钥格式
   */
  validatePrivateKey(privateKey) {
    if (!privateKey || typeof privateKey !== 'string') {
      return false;
    }
    
    // 检查是否包含私钥标识
    const keyPatterns = [
      /-----BEGIN OPENSSH PRIVATE KEY-----/,
      /-----BEGIN RSA PRIVATE KEY-----/,
      /-----BEGIN DSA PRIVATE KEY-----/,
      /-----BEGIN EC PRIVATE KEY-----/,
      /-----BEGIN PRIVATE KEY-----/
    ];
    
    return keyPatterns.some(pattern => pattern.test(privateKey));
  }

  /**
   * 生成密钥指纹
   */
  generateKeyFingerprint(privateKey) {
    try {
      // 简单的指纹生成，实际项目中可能需要更复杂的实现
      const hash = crypto.createHash('md5');
      hash.update(privateKey);
      const fingerprint = hash.digest('hex');
      
      // 格式化为标准指纹格式
      return fingerprint.match(/.{2}/g).join(':');
    } catch (error) {
      logger.error('生成密钥指纹失败:', error);
      return null;
    }
  }

  /**
   * 验证TOTP代码
   */
  async verifyTOTP(hostId, totpCode) {
    // 简单的TOTP验证示例
    // 实际项目中需要集成TOTP库如speakeasy
    try {
      // 这里应该根据主机配置的TOTP密钥进行验证
      // 暂时返回简单验证逻辑
      return totpCode && totpCode.length === 6 && /^\d+$/.test(totpCode);
    } catch (error) {
      logger.error('TOTP验证失败:', error);
      return false;
    }
  }

  /**
   * 记录认证事件
   */
  async logAuthEvent(hostId, authType, status, metadata = {}) {
    try {
      await database.run(
        'INSERT INTO audit_logs (host_id, action, category, status, risk_level, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [
          hostId,
          `auth_${authType}`,
          'ssh',
          status,
          status === 'success' ? 'low' : 'medium',
          JSON.stringify(metadata)
        ]
      );
    } catch (error) {
      logger.error('记录认证事件失败:', error);
    }
  }

  /**
   * 获取认证统计
   */
  async getAuthStats(hostId = null) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          action
        FROM audit_logs 
        WHERE action LIKE 'auth_%'
      `;
      
      const params = [];
      
      if (hostId) {
        query += ' AND host_id = ?';
        params.push(hostId);
      }
      
      query += ' GROUP BY action ORDER BY total DESC';
      
      const stats = await database.query(query, params);
      
      return {
        byType: stats,
        summary: {
          total: stats.reduce((sum, stat) => sum + stat.total, 0),
          successful: stats.reduce((sum, stat) => sum + stat.successful, 0),
          failed: stats.reduce((sum, stat) => sum + stat.failed, 0)
        }
      };
      
    } catch (error) {
      logger.error('获取认证统计失败:', error);
      return null;
    }
  }
}

module.exports = new AuthService();