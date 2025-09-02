const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * SSH会话模型
 */
class SSHSession extends BaseModel {
  constructor() {
    super('ssh_sessions');
  }

  /**
   * 创建SSH会话
   */
  async createSession(hostId, sessionToken, clientInfo = {}) {
    try {
      const sessionData = {
        host_id: hostId,
        session_token: sessionToken,
        client_ip: clientInfo.ip,
        user_agent: clientInfo.userAgent,
        status: 'active',
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      };

      return await this.create(sessionData);
    } catch (error) {
      logger.error('创建SSH会话失败:', error);
      throw error;
    }
  }

  /**
   * 更新会话活动时间
   */
  async updateActivity(sessionToken) {
    try {
      const sql = `
        UPDATE ${this.tableName} 
        SET last_activity_at = ?
        WHERE session_token = ? AND status = 'active'
      `;
      
      return await this.rawRun(sql, [new Date().toISOString(), sessionToken]);
    } catch (error) {
      logger.error('更新会话活动时间失败:', error);
      throw error;
    }
  }

  /**
   * 终止会话
   */
  async terminateSession(sessionToken, reason = 'normal') {
    try {
      const updateData = {
        status: 'terminated',
        ended_at: new Date().toISOString()
      };

      const sql = `
        UPDATE ${this.tableName}
        SET status = ?, ended_at = ?
        WHERE session_token = ?
      `;

      return await this.rawRun(sql, [updateData.status, updateData.ended_at, sessionToken]);
    } catch (error) {
      logger.error('终止SSH会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取活动会话
   */
  async getActiveSessions(hostId = null) {
    try {
      let sql = `
        SELECT s.*, h.name as host_name, h.hostname
        FROM ${this.tableName} s
        LEFT JOIN hosts h ON s.host_id = h.id
        WHERE s.status = 'active'
      `;
      
      const params = [];
      
      if (hostId) {
        sql += ' AND s.host_id = ?';
        params.push(hostId);
      }
      
      sql += ' ORDER BY s.started_at DESC';
      
      return await this.rawQuery(sql, params);
    } catch (error) {
      logger.error('获取活动会话失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(timeoutMinutes = 30) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - timeoutMinutes);
      
      const sql = `
        UPDATE ${this.tableName}
        SET status = 'inactive', ended_at = ?
        WHERE status = 'active' AND last_activity_at < ?
      `;
      
      const result = await this.rawRun(sql, [
        new Date().toISOString(),
        cutoffTime.toISOString()
      ]);
      
      logger.database('清理过期SSH会话:', result.changes);
      return result.changes;
    } catch (error) {
      logger.error('清理过期会话失败:', error);
      throw error;
    }
  }
}

/**
 * 文件传输模型
 */
class FileTransfer extends BaseModel {
  constructor() {
    super('file_transfers');
  }

  /**
   * 创建文件传输任务
   */
  async createTransfer(transferData) {
    try {
      const data = {
        ...transferData,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      return await this.create(data);
    } catch (error) {
      logger.error('创建文件传输任务失败:', error);
      throw error;
    }
  }

  /**
   * 更新传输进度
   */
  async updateProgress(transferId, progress) {
    try {
      const updateData = {
        transferred_size: progress.transferredSize,
        transfer_speed: progress.speed,
        updated_at: new Date().toISOString()
      };

      if (progress.status) {
        updateData.status = progress.status;
        
        if (progress.status === 'transferring' && !progress.startedAt) {
          updateData.started_at = new Date().toISOString();
        } else if (progress.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      return await this.update(transferId, updateData);
    } catch (error) {
      logger.error('更新传输进度失败:', error);
      throw error;
    }
  }

  /**
   * 标记传输完成
   */
  async completeTransfer(transferId, checksum = null) {
    try {
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString()
      };

      if (checksum) {
        updateData.checksum = checksum;
      }

      return await this.update(transferId, updateData);
    } catch (error) {
      logger.error('标记传输完成失败:', error);
      throw error;
    }
  }

  /**
   * 标记传输失败
   */
  async failTransfer(transferId, errorMessage) {
    try {
      const updateData = {
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      };

      return await this.update(transferId, updateData);
    } catch (error) {
      logger.error('标记传输失败失败:', error);
      throw error;
    }
  }

  /**
   * 获取传输队列
   */
  async getTransferQueue(hostId = null) {
    try {
      let sql = `
        SELECT ft.*, h.name as host_name
        FROM ${this.tableName} ft
        LEFT JOIN hosts h ON ft.host_id = h.id
        WHERE ft.status IN ('pending', 'transferring', 'paused')
      `;
      
      const params = [];
      
      if (hostId) {
        sql += ' AND ft.host_id = ?';
        params.push(hostId);
      }
      
      sql += ' ORDER BY ft.created_at ASC';
      
      return await this.rawQuery(sql, params);
    } catch (error) {
      logger.error('获取传输队列失败:', error);
      throw error;
    }
  }

  /**
   * 获取传输历史
   */
  async getTransferHistory(hostId = null, limit = 50) {
    try {
      let sql = `
        SELECT ft.*, h.name as host_name
        FROM ${this.tableName} ft
        LEFT JOIN hosts h ON ft.host_id = h.id
        WHERE ft.status IN ('completed', 'failed', 'cancelled')
      `;
      
      const params = [];
      
      if (hostId) {
        sql += ' AND ft.host_id = ?';
        params.push(hostId);
      }
      
      sql += ` ORDER BY ft.completed_at DESC LIMIT ${limit}`;
      
      return await this.rawQuery(sql, params);
    } catch (error) {
      logger.error('获取传输历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取传输统计
   */
  async getTransferStats(hostId = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'transferring' THEN 1 ELSE 0 END) as transferring,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'completed' THEN file_size ELSE 0 END) as total_bytes_transferred
        FROM ${this.tableName}
      `;
      
      const params = [];
      
      if (hostId) {
        sql += ' WHERE host_id = ?';
        params.push(hostId);
      }
      
      const result = await this.rawQuery(sql, params);
      return result[0] || {
        total: 0,
        completed: 0,
        failed: 0,
        transferring: 0,
        pending: 0,
        total_bytes_transferred: 0
      };
    } catch (error) {
      logger.error('获取传输统计失败:', error);
      throw error;
    }
  }
}

module.exports = {
  SSHSession,
  FileTransfer
};