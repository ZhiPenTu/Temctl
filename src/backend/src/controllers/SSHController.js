const sshManager = require('../services/SSHService');
const { Host, SSHSession, AuditLog } = require('../models');
const logger = require('../utils/logger');
const crypto = require('../utils/crypto');

/**
 * SSH连接控制器
 */
class SSHController {
  /**
   * 建立SSH连接
   */
  static async connect(ctx) {
    try {
      const { hostId, authInfo } = ctx.request.body;
      
      if (!hostId || !authInfo) {
        ctx.throw(400, '缺少必要参数');
      }

      // 获取客户端信息
      const clientInfo = {
        ip: ctx.ip,
        userAgent: ctx.headers['user-agent']
      };

      // 解密认证信息（如果需要）
      let decryptedAuthInfo = authInfo;
      if (authInfo.encrypted) {
        decryptedAuthInfo = await crypto.decryptAuthInfo(authInfo);
      }

      // 建立连接
      const connection = await sshManager.connect(hostId, decryptedAuthInfo, clientInfo);
      
      ctx.body = {
        success: true,
        data: {
          sessionToken: connection.id,
          hostId: connection.hostId,
          hostname: connection.host.hostname,
          username: connection.host.username,
          connectedAt: connection.connectedAt,
          status: 'connected'
        }
      };
      
    } catch (error) {
      logger.error('SSH连接失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 断开SSH连接
   */
  static async disconnect(ctx) {
    try {
      const { sessionToken } = ctx.params;
      const { reason } = ctx.request.body;
      
      await sshManager.disconnect(sessionToken, reason || 'user_request');
      
      ctx.body = {
        success: true,
        message: '连接已断开'
      };
      
    } catch (error) {
      logger.error('断开SSH连接失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 执行SSH命令
   */
  static async executeCommand(ctx) {
    try {
      const { sessionToken } = ctx.params;
      const { command, options = {} } = ctx.request.body;
      
      if (!command) {
        ctx.throw(400, '命令不能为空');
      }

      // TODO: 在这里添加安全检查和命令过滤
      
      const result = await sshManager.executeCommand(sessionToken, command, options);
      
      ctx.body = {
        success: true,
        data: result
      };
      
    } catch (error) {
      logger.error('执行SSH命令失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 获取连接信息
   */
  static async getConnection(ctx) {
    try {
      const { sessionToken } = ctx.params;
      
      const connection = sshManager.getConnection(sessionToken);
      
      if (!connection) {
        ctx.throw(404, '连接不存在');
      }
      
      ctx.body = {
        success: true,
        data: {
          sessionToken: connection.id,
          hostId: connection.hostId,
          hostname: connection.host.hostname,
          username: connection.host.username,
          connectedAt: connection.connectedAt,
          lastActivity: connection.lastActivity,
          status: connection.status
        }
      };
      
    } catch (error) {
      logger.error('获取连接信息失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 获取所有活动连接
   */
  static async getActiveConnections(ctx) {
    try {
      const connections = sshManager.getActiveConnections();
      
      const connectionsData = connections.map(conn => ({
        sessionToken: conn.id,
        hostId: conn.hostId,
        hostname: conn.host.hostname,
        username: conn.host.username,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        status: conn.status,
        clientInfo: {
          ip: conn.clientInfo.ip,
          userAgent: conn.clientInfo.userAgent
        }
      }));
      
      ctx.body = {
        success: true,
        data: connectionsData,
        total: connectionsData.length
      };
      
    } catch (error) {
      logger.error('获取活动连接失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 获取主机连接
   */
  static async getHostConnections(ctx) {
    try {
      const { hostId } = ctx.params;
      
      const connections = sshManager.getHostConnections(hostId);
      
      const connectionsData = connections.map(conn => ({
        sessionToken: conn.id,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        status: conn.status,
        clientInfo: {
          ip: conn.clientInfo.ip,
          userAgent: conn.clientInfo.userAgent
        }
      }));
      
      ctx.body = {
        success: true,
        data: connectionsData,
        total: connectionsData.length
      };
      
    } catch (error) {
      logger.error('获取主机连接失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 断开主机所有连接
   */
  static async disconnectHost(ctx) {
    try {
      const { hostId } = ctx.params;
      const { reason } = ctx.request.body;
      
      const count = await sshManager.disconnectHost(hostId, reason || 'admin_request');
      
      ctx.body = {
        success: true,
        data: {
          disconnectedCount: count
        },
        message: `已断开${count}个连接`
      };
      
    } catch (error) {
      logger.error('断开主机连接失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 断开所有连接
   */
  static async disconnectAll(ctx) {
    try {
      const { reason } = ctx.request.body;
      
      const count = await sshManager.disconnectAll(reason || 'admin_request');
      
      ctx.body = {
        success: true,
        data: {
          disconnectedCount: count
        },
        message: `已断开所有${count}个连接`
      };
      
    } catch (error) {
      logger.error('断开所有连接失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 获取连接统计信息
   */
  static async getConnectionStats(ctx) {
    try {
      const stats = sshManager.getConnectionStats();
      
      ctx.body = {
        success: true,
        data: stats
      };
      
    } catch (error) {
      logger.error('获取连接统计失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 获取SSH会话历史
   */
  static async getSessionHistory(ctx) {
    try {
      const { page = 1, pageSize = 20, hostId } = ctx.query;
      
      const sessionModel = new SSHSession();
      const options = {
        orderBy: 'created_at DESC'
      };
      
      if (hostId) {
        options.where = { host_id: hostId };
      }
      
      const result = await sessionModel.paginate(
        parseInt(page),
        parseInt(pageSize),
        options
      );
      
      ctx.body = {
        success: true,
        data: result.items,
        pagination: result.pagination
      };
      
    } catch (error) {
      logger.error('获取SSH会话历史失败:', error);
      ctx.throw(500, error.message);
    }
  }

  /**
   * 测试SSH连接
   */
  static async testConnection(ctx) {
    try {
      const { hostInfo, authInfo } = ctx.request.body;
      
      if (!hostInfo || !authInfo) {
        ctx.throw(400, '缺少必要参数');
      }

      // 创建临时主机对象进行测试
      const tempHost = {
        hostname: hostInfo.hostname,
        port: hostInfo.port || 22,
        username: hostInfo.username
      };

      // 获取客户端信息
      const clientInfo = {
        ip: ctx.ip,
        userAgent: ctx.headers['user-agent']
      };

      // 解密认证信息（如果需要）
      let decryptedAuthInfo = authInfo;
      if (authInfo.encrypted) {
        decryptedAuthInfo = await crypto.decryptAuthInfo(authInfo);
      }

      // 测试连接（不保存到连接池）
      const testResult = await SSHController.performConnectionTest(
        tempHost,
        decryptedAuthInfo,
        clientInfo
      );
      
      ctx.body = {
        success: true,
        data: testResult
      };
      
    } catch (error) {
      logger.error('测试SSH连接失败:', error);
      ctx.body = {
        success: false,
        error: {
          message: error.message,
          code: 'CONNECTION_TEST_FAILED'
        }
      };
    }
  }

  /**
   * 执行连接测试
   */
  static async performConnectionTest(host, authInfo, clientInfo) {
    return new Promise((resolve, reject) => {
      const { Client } = require('ssh2');
      const conn = new Client();
      const startTime = Date.now();
      
      const connectOptions = {
        host: host.hostname,
        port: host.port,
        username: host.username,
        readyTimeout: 10000 // 10秒超时
      };

      // 设置认证信息
      if (authInfo.type === 'password') {
        connectOptions.password = authInfo.password;
      } else if (authInfo.type === 'key') {
        if (authInfo.privateKey) {
          connectOptions.privateKey = authInfo.privateKey;
        }
        if (authInfo.passphrase) {
          connectOptions.passphrase = authInfo.passphrase;
        }
      }

      conn.on('ready', () => {
        const connectTime = Date.now() - startTime;
        
        // 执行简单命令测试
        conn.exec('echo "test"', (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          stream.on('close', () => {
            conn.end();
            resolve({
              success: true,
              connectTime,
              message: '连接测试成功',
              serverInfo: {
                hostname: host.hostname,
                port: host.port,
                username: host.username
              }
            });
          });

          stream.on('data', () => {
            // 忽略输出
          });
        });
      });

      conn.on('error', (err) => {
        reject(new Error(`连接失败: ${err.message}`));
      });

      conn.connect(connectOptions);
    });
  }
}

module.exports = SSHController;