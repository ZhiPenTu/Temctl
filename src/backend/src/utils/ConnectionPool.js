// SSH连接池管理器 - 优化连接复用和性能

class ConnectionPool {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.idleTimeout = options.idleTimeout || 300000; // 5分钟
    this.connections = new Map(); // hostId -> connection
    this.connectionQueue = new Map(); // hostId -> queue
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      poolHits: 0,
      poolMisses: 0
    };
    
    // 定期清理空闲连接
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  /**
   * 获取SSH连接
   */
  async getConnection(hostConfig) {
    const hostId = hostConfig.id;
    const existingConnection = this.connections.get(hostId);

    // 检查现有连接是否可用
    if (existingConnection && this.isConnectionValid(existingConnection)) {
      this.stats.poolHits++;
      existingConnection.lastUsed = Date.now();
      return existingConnection.connection;
    }

    this.stats.poolMisses++;
    
    // 如果没有可用连接，创建新连接
    return await this.createConnection(hostConfig);
  }

  /**
   * 创建新的SSH连接
   */
  async createConnection(hostConfig) {
    const { Client } = require('ssh2');
    const client = new Client();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('连接超时'));
      }, hostConfig.timeout || 30000);

      client.on('ready', () => {
        clearTimeout(timeout);
        
        const connectionInfo = {
          connection: client,
          hostId: hostConfig.id,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          isActive: true
        };

        // 设置连接事件监听
        this.setupConnectionEvents(client, hostConfig.id);
        
        // 添加到连接池
        this.connections.set(hostConfig.id, connectionInfo);
        this.stats.activeConnections++;
        this.stats.totalConnections++;

        resolve(client);
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // 建立连接
      const connectOptions = {
        host: hostConfig.hostname,
        port: hostConfig.port,
        username: hostConfig.username,
        keepaliveInterval: 60000,
        keepaliveCountMax: 3
      };

      if (hostConfig.authType === 'password') {
        connectOptions.password = hostConfig.password;
      } else if (hostConfig.authType === 'key') {
        connectOptions.privateKey = require('fs').readFileSync(hostConfig.privateKeyPath);
        if (hostConfig.passphrase) {
          connectOptions.passphrase = hostConfig.passphrase;
        }
      }

      client.connect(connectOptions);
    });
  }

  /**
   * 设置连接事件监听
   */
  setupConnectionEvents(client, hostId) {
    client.on('close', () => {
      const connectionInfo = this.connections.get(hostId);
      if (connectionInfo) {
        connectionInfo.isActive = false;
        this.stats.activeConnections--;
      }
    });

    client.on('error', (error) => {
      console.error(`SSH连接错误 (${hostId}):`, error);
      this.removeConnection(hostId);
    });
  }

  /**
   * 检查连接是否有效
   */
  isConnectionValid(connectionInfo) {
    if (!connectionInfo || !connectionInfo.isActive) {
      return false;
    }

    // 检查是否超时
    const now = Date.now();
    if (now - connectionInfo.lastUsed > this.idleTimeout) {
      return false;
    }

    return true;
  }

  /**
   * 释放连接（保持在池中）
   */
  releaseConnection(hostId) {
    const connectionInfo = this.connections.get(hostId);
    if (connectionInfo) {
      connectionInfo.lastUsed = Date.now();
    }
  }

  /**
   * 移除连接
   */
  removeConnection(hostId) {
    const connectionInfo = this.connections.get(hostId);
    if (connectionInfo) {
      if (connectionInfo.connection && connectionInfo.isActive) {
        connectionInfo.connection.destroy();
      }
      this.connections.delete(hostId);
      if (connectionInfo.isActive) {
        this.stats.activeConnections--;
      }
    }
  }

  /**
   * 清理空闲连接
   */
  cleanupIdleConnections() {
    const now = Date.now();
    const toRemove = [];

    for (const [hostId, connectionInfo] of this.connections) {
      if (!this.isConnectionValid(connectionInfo)) {
        toRemove.push(hostId);
      }
    }

    toRemove.forEach(hostId => {
      console.log(`清理空闲连接: ${hostId}`);
      this.removeConnection(hostId);
    });
  }

  /**
   * 获取连接池统计信息
   */
  getStats() {
    return {
      ...this.stats,
      poolSize: this.connections.size,
      hitRate: this.stats.poolHits / (this.stats.poolHits + this.stats.poolMisses) || 0
    };
  }

  /**
   * 关闭所有连接
   */
  async closeAll() {
    const promises = [];
    
    for (const [hostId, connectionInfo] of this.connections) {
      if (connectionInfo.connection && connectionInfo.isActive) {
        promises.push(
          new Promise((resolve) => {
            connectionInfo.connection.end();
            setTimeout(resolve, 1000); // 给连接1秒时间正常关闭
          })
        );
      }
    }

    await Promise.all(promises);
    this.connections.clear();
    this.stats.activeConnections = 0;
  }

  /**
   * 强制刷新连接
   */
  refreshConnection(hostId) {
    this.removeConnection(hostId);
  }
}

module.exports = ConnectionPool;