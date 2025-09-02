const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * AI会话模型
 */
class AISession extends BaseModel {
  constructor() {
    super('ai_sessions');
  }

  /**
   * 创建AI会话
   */
  async createSession(sessionData) {
    try {
      const data = {
        title: sessionData.title || '新对话',
        host_id: sessionData.hostId || null,
        provider: sessionData.provider || 'openai',
        model: sessionData.model || 'gpt-3.5-turbo',
        context: JSON.stringify(sessionData.context || {})
      };

      return await this.create(data);
    } catch (error) {
      logger.error('创建AI会话失败:', error);
      throw error;
    }
  }

  /**
   * 更新会话上下文
   */
  async updateContext(sessionId, context) {
    try {
      return await this.update(sessionId, {
        context: JSON.stringify(context),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('更新AI会话上下文失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话及其消息
   */
  async getSessionWithMessages(sessionId) {
    try {
      const sql = `
        SELECT 
          s.*,
          m.id as message_id,
          m.role as message_role,
          m.content as message_content,
          m.metadata as message_metadata,
          m.tokens_used,
          m.response_time,
          m.created_at as message_created_at
        FROM ${this.tableName} s
        LEFT JOIN ai_messages m ON s.id = m.session_id
        WHERE s.id = ?
        ORDER BY m.created_at ASC
      `;

      const rows = await this.rawQuery(sql, [sessionId]);
      
      if (rows.length === 0) {
        return null;
      }

      // 构建会话对象
      const session = {
        id: rows[0].id,
        title: rows[0].title,
        host_id: rows[0].host_id,
        provider: rows[0].provider,
        model: rows[0].model,
        context: JSON.parse(rows[0].context || '{}'),
        created_at: rows[0].created_at,
        updated_at: rows[0].updated_at,
        messages: []
      };

      // 添加消息
      rows.forEach(row => {
        if (row.message_id) {
          session.messages.push({
            id: row.message_id,
            role: row.message_role,
            content: row.message_content,
            metadata: JSON.parse(row.message_metadata || '{}'),
            tokens_used: row.tokens_used,
            response_time: row.response_time,
            created_at: row.message_created_at
          });
        }
      });

      return session;
    } catch (error) {
      logger.error('获取AI会话及消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的AI会话列表
   */
  async getUserSessions(hostId = null, limit = 20) {
    try {
      let sql = `
        SELECT s.*, COUNT(m.id) as message_count
        FROM ${this.tableName} s
        LEFT JOIN ai_messages m ON s.id = m.session_id
      `;
      
      const params = [];
      
      if (hostId) {
        sql += ' WHERE s.host_id = ?';
        params.push(hostId);
      }
      
      sql += `
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT ${limit}
      `;
      
      return await this.rawQuery(sql, params);
    } catch (error) {
      logger.error('获取用户AI会话列表失败:', error);
      throw error;
    }
  }
}

/**
 * AI消息模型
 */
class AIMessage extends BaseModel {
  constructor() {
    super('ai_messages');
  }

  /**
   * 添加消息到会话
   */
  async addMessage(messageData) {
    try {
      const data = {
        session_id: messageData.sessionId,
        role: messageData.role,
        content: messageData.content,
        metadata: JSON.stringify(messageData.metadata || {}),
        tokens_used: messageData.tokensUsed || null,
        response_time: messageData.responseTime || null
      };

      return await this.create(data);
    } catch (error) {
      logger.error('添加AI消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话消息
   */
  async getSessionMessages(sessionId, limit = 100) {
    try {
      return await this.findAll({
        where: { session_id: sessionId },
        orderBy: 'created_at ASC',
        limit
      });
    } catch (error) {
      logger.error('获取会话消息失败:', error);
      throw error;
    }
  }

  /**
   * 删除会话所有消息
   */
  async deleteSessionMessages(sessionId) {
    try {
      return await this.deleteMany({ session_id: sessionId });
    } catch (error) {
      logger.error('删除会话消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取AI使用统计
   */
  async getUsageStats(startDate = null, endDate = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
          SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
          SUM(tokens_used) as total_tokens,
          AVG(response_time) as avg_response_time
        FROM ${this.tableName}
        WHERE 1=1
      `;
      
      const params = [];
      
      if (startDate) {
        sql += ' AND created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        sql += ' AND created_at <= ?';
        params.push(endDate);
      }
      
      const result = await this.rawQuery(sql, params);
      return result[0] || {
        total_messages: 0,
        user_messages: 0,
        assistant_messages: 0,
        total_tokens: 0,
        avg_response_time: 0
      };
    } catch (error) {
      logger.error('获取AI使用统计失败:', error);
      throw error;
    }
  }
}

/**
 * 安全规则模型
 */
class SecurityRule extends BaseModel {
  constructor() {
    super('security_rules');
  }

  /**
   * 获取启用的安全规则
   */
  async getEnabledRules() {
    try {
      return await this.findAll({
        where: { enabled: true },
        orderBy: 'severity DESC, created_at ASC'
      });
    } catch (error) {
      logger.error('获取启用的安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 根据类型获取规则
   */
  async getRulesByType(type) {
    try {
      return await this.findAll({
        where: { type, enabled: true },
        orderBy: 'severity DESC'
      });
    } catch (error) {
      logger.error('根据类型获取安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 切换规则状态
   */
  async toggleRule(ruleId) {
    try {
      const rule = await this.findById(ruleId);
      if (!rule) {
        throw new Error('安全规则不存在');
      }

      return await this.update(ruleId, {
        enabled: !rule.enabled
      });
    } catch (error) {
      logger.error('切换安全规则状态失败:', error);
      throw error;
    }
  }
}

/**
 * 审计日志模型
 */
class AuditLog extends BaseModel {
  constructor() {
    super('audit_logs');
  }

  /**
   * 记录审计日志
   */
  async log(logData) {
    try {
      const data = {
        user_id: logData.userId || null,
        host_id: logData.hostId || null,
        session_id: logData.sessionId || null,
        action: logData.action,
        category: logData.category,
        command: logData.command || null,
        result: logData.result || null,
        status: logData.status,
        risk_level: logData.riskLevel || 'low',
        ip_address: logData.ipAddress || null,
        user_agent: logData.userAgent || null,
        metadata: JSON.stringify(logData.metadata || {})
      };

      return await this.create(data);
    } catch (error) {
      logger.error('记录审计日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计日志
   */
  async getLogs(filters = {}, page = 1, pageSize = 50) {
    try {
      const options = {
        orderBy: 'created_at DESC'
      };

      // 添加过滤条件
      if (filters.category) {
        options.where = { ...options.where, category: filters.category };
      }
      
      if (filters.status) {
        options.where = { ...options.where, status: filters.status };
      }
      
      if (filters.riskLevel) {
        options.where = { ...options.where, risk_level: filters.riskLevel };
      }

      return await this.paginate(page, pageSize, options);
    } catch (error) {
      logger.error('获取审计日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取安全统计
   */
  async getSecurityStats(startDate = null, endDate = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_events,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
          SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
          SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
          SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_count
        FROM ${this.tableName}
        WHERE 1=1
      `;
      
      const params = [];
      
      if (startDate) {
        sql += ' AND created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        sql += ' AND created_at <= ?';
        params.push(endDate);
      }
      
      const result = await this.rawQuery(sql, params);
      return result[0] || {
        total_events: 0,
        success_count: 0,
        failed_count: 0,
        blocked_count: 0,
        warning_count: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0
      };
    } catch (error) {
      logger.error('获取安全统计失败:', error);
      throw error;
    }
  }
}

module.exports = {
  AISession,
  AIMessage,
  SecurityRule,
  AuditLog
};