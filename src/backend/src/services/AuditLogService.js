const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * 审计日志服务
 * 记录和管理系统操作日志
 */
class AuditLogService {
  constructor() {
    // 日志类别定义
    this.categories = {
      ssh: 'SSH连接和操作',
      ftp: '文件传输操作',
      ai: 'AI交互操作',
      security: '安全管控操作',
      system: '系统管理操作'
    };
    
    // 风险等级定义
    this.riskLevels = {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
      critical: '严重风险'
    };
    
    // 操作状态定义
    this.statuses = {
      success: '成功',
      failed: '失败',
      blocked: '被阻止',
      warning: '警告'
    };
  }

  /**
   * 记录审计日志
   */
  async log(logData) {
    try {
      const {
        userId = null,
        hostId = null,
        sessionId = null,
        action,
        category,
        command = null,
        result = null,
        status,
        riskLevel = 'low',
        ipAddress = null,
        userAgent = null,
        metadata = {}
      } = logData;
      
      // 验证必填字段
      if (!action || !category || !status) {
        throw new Error('action、category和status是必填字段');
      }
      
      // 验证枚举值
      if (!Object.keys(this.categories).includes(category)) {
        throw new Error(`无效的日志类别: ${category}`);
      }
      
      if (!Object.keys(this.riskLevels).includes(riskLevel)) {
        throw new Error(`无效的风险等级: ${riskLevel}`);
      }
      
      if (!Object.keys(this.statuses).includes(status)) {
        throw new Error(`无效的操作状态: ${status}`);
      }
      
      const logId = this.generateLogId();
      
      await database.run(`
        INSERT INTO audit_logs (
          id, user_id, host_id, session_id, action, category, 
          command, result, status, risk_level, ip_address, 
          user_agent, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        logId,
        userId,
        hostId,
        sessionId,
        action,
        category,
        command,
        result,
        status,
        riskLevel,
        ipAddress,
        userAgent,
        JSON.stringify(metadata)
      ]);
      
      logger.info('审计日志记录成功:', { logId, action, category, status });
      
      return logId;
      
    } catch (error) {
      logger.error('记录审计日志失败:', error);
      throw error;
    }
  }

  /**
   * 批量记录审计日志
   */
  async batchLog(logDataArray) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };
      
      for (const logData of logDataArray) {
        try {
          await this.log(logData);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            logData,
            error: error.message
          });
        }
      }
      
      logger.info('批量记录审计日志完成:', results);
      
      return results;
      
    } catch (error) {
      logger.error('批量记录审计日志失败:', error);
      throw error;
    }
  }

  /**
   * 查询审计日志
   */
  async query(filters = {}, pagination = {}) {
    try {
      const {
        userId,
        hostId,
        sessionId,
        category,
        action,
        status,
        riskLevel,
        startTime,
        endTime,
        keyword
      } = filters;
      
      const { page = 1, limit = 20, orderBy = 'created_at', order = 'DESC' } = pagination;
      const offset = (page - 1) * limit;
      
      let query = 'SELECT * FROM audit_logs';
      const params = [];
      const conditions = [];
      
      // 构建查询条件
      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      
      if (hostId) {
        conditions.push('host_id = ?');
        params.push(hostId);
      }
      
      if (sessionId) {
        conditions.push('session_id = ?');
        params.push(sessionId);
      }
      
      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }
      
      if (action) {
        conditions.push('action = ?');
        params.push(action);
      }
      
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      
      if (riskLevel) {
        conditions.push('risk_level = ?');
        params.push(riskLevel);
      }
      
      if (startTime) {
        conditions.push('created_at >= ?');
        params.push(startTime);
      }
      
      if (endTime) {
        conditions.push('created_at <= ?');
        params.push(endTime);
      }
      
      if (keyword) {
        conditions.push('(action LIKE ? OR command LIKE ? OR result LIKE ?)');\n        const keywordPattern = `%${keyword}%`;\n        params.push(keywordPattern, keywordPattern, keywordPattern);\n      }\n      \n      if (conditions.length > 0) {\n        query += ' WHERE ' + conditions.join(' AND ');\n      }\n      \n      // 添加排序和分页\n      const validOrderBy = ['created_at', 'action', 'category', 'status', 'risk_level'];\n      const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'created_at';\n      const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';\n      \n      query += ` ORDER BY ${safeOrderBy} ${safeOrder} LIMIT ? OFFSET ?`;\n      params.push(parseInt(limit), offset);\n      \n      const logs = await database.query(query, params);\n      \n      // 查询总数\n      let countQuery = 'SELECT COUNT(*) as count FROM audit_logs';\n      const countParams = params.slice(0, -2); // 移除limit和offset参数\n      \n      if (conditions.length > 0) {\n        countQuery += ' WHERE ' + conditions.join(' AND ');\n      }\n      \n      const total = await database.get(countQuery, countParams);\n      \n      // 解析metadata字段\n      const enrichedLogs = logs.map(log => ({\n        ...log,\n        metadata: this.parseMetadata(log.metadata)\n      }));\n      \n      return {\n        logs: enrichedLogs,\n        pagination: {\n          page: parseInt(page),\n          limit: parseInt(limit),\n          total: total.count,\n          totalPages: Math.ceil(total.count / limit)\n        }\n      };\n      \n    } catch (error) {\n      logger.error('查询审计日志失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 获取日志详情\n   */\n  async getLogDetail(logId) {\n    try {\n      const log = await database.get('SELECT * FROM audit_logs WHERE id = ?', [logId]);\n      \n      if (!log) {\n        throw new Error('审计日志不存在');\n      }\n      \n      // 解析metadata\n      log.metadata = this.parseMetadata(log.metadata);\n      \n      // 如果有关联主机，获取主机信息\n      if (log.host_id) {\n        const host = await database.get('SELECT id, name, hostname FROM hosts WHERE id = ?', [log.host_id]);\n        log.hostInfo = host;\n      }\n      \n      return log;\n      \n    } catch (error) {\n      logger.error('获取日志详情失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 删除审计日志\n   */\n  async deleteLog(logId) {\n    try {\n      const result = await database.run('DELETE FROM audit_logs WHERE id = ?', [logId]);\n      \n      if (result.changes === 0) {\n        throw new Error('审计日志不存在');\n      }\n      \n      logger.info('审计日志删除成功:', logId);\n      \n    } catch (error) {\n      logger.error('删除审计日志失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 批量删除审计日志\n   */\n  async batchDelete(filters = {}) {\n    try {\n      const { category, status, riskLevel, beforeDate } = filters;\n      \n      let query = 'DELETE FROM audit_logs';\n      const params = [];\n      const conditions = [];\n      \n      if (category) {\n        conditions.push('category = ?');\n        params.push(category);\n      }\n      \n      if (status) {\n        conditions.push('status = ?');\n        params.push(status);\n      }\n      \n      if (riskLevel) {\n        conditions.push('risk_level = ?');\n        params.push(riskLevel);\n      }\n      \n      if (beforeDate) {\n        conditions.push('created_at < ?');\n        params.push(beforeDate);\n      }\n      \n      if (conditions.length === 0) {\n        throw new Error('必须提供至少一个删除条件');\n      }\n      \n      query += ' WHERE ' + conditions.join(' AND ');\n      \n      const result = await database.run(query, params);\n      \n      logger.info('批量删除审计日志完成:', { deleted: result.changes, filters });\n      \n      return result.changes;\n      \n    } catch (error) {\n      logger.error('批量删除审计日志失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 获取审计统计\n   */\n  async getStatistics(timeRange = '7d') {\n    try {\n      const stats = {};\n      \n      // 计算时间范围\n      const timeCondition = this.getTimeCondition(timeRange);\n      \n      // 按类别统计\n      const categoryStats = await database.query(`\n        SELECT category, COUNT(*) as count, \n               SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,\n               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,\n               SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count\n        FROM audit_logs \n        WHERE ${timeCondition} \n        GROUP BY category\n      `);\n      \n      stats.byCategory = categoryStats;\n      \n      // 按风险等级统计\n      const riskStats = await database.query(`\n        SELECT risk_level, COUNT(*) as count \n        FROM audit_logs \n        WHERE ${timeCondition} \n        GROUP BY risk_level\n      `);\n      \n      stats.byRiskLevel = riskStats;\n      \n      // 按状态统计\n      const statusStats = await database.query(`\n        SELECT status, COUNT(*) as count \n        FROM audit_logs \n        WHERE ${timeCondition} \n        GROUP BY status\n      `);\n      \n      stats.byStatus = statusStats;\n      \n      // 时间趋势统计\n      const trendStats = await database.query(`\n        SELECT DATE(created_at) as date, \n               COUNT(*) as total,\n               SUM(CASE WHEN risk_level IN ('high', 'critical') THEN 1 ELSE 0 END) as high_risk\n        FROM audit_logs \n        WHERE ${timeCondition} \n        GROUP BY DATE(created_at) \n        ORDER BY date\n      `);\n      \n      stats.trend = trendStats;\n      \n      // 热门操作统计\n      const actionStats = await database.query(`\n        SELECT action, COUNT(*) as count \n        FROM audit_logs \n        WHERE ${timeCondition} \n        GROUP BY action \n        ORDER BY count DESC \n        LIMIT 10\n      `);\n      \n      stats.topActions = actionStats;\n      \n      // 总体统计\n      const totalStats = await database.get(`\n        SELECT COUNT(*) as total,\n               SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,\n               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,\n               SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,\n               SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical,\n               SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_risk\n        FROM audit_logs \n        WHERE ${timeCondition}\n      `);\n      \n      stats.summary = totalStats;\n      \n      return stats;\n      \n    } catch (error) {\n      logger.error('获取审计统计失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 导出审计日志\n   */\n  async exportLogs(filters = {}, format = 'json') {\n    try {\n      const result = await this.query(filters, { page: 1, limit: 10000 });\n      const logs = result.logs;\n      \n      if (format === 'csv') {\n        return this.convertToCSV(logs);\n      } else {\n        return JSON.stringify(logs, null, 2);\n      }\n      \n    } catch (error) {\n      logger.error('导出审计日志失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 清理过期日志\n   */\n  async cleanup(retentionDays = 90) {\n    try {\n      const cutoffDate = new Date();\n      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);\n      \n      const result = await database.run(\n        'DELETE FROM audit_logs WHERE created_at < ?',\n        [cutoffDate.toISOString()]\n      );\n      \n      logger.info('清理过期审计日志:', { deleted: result.changes, retentionDays });\n      \n      return result.changes;\n      \n    } catch (error) {\n      logger.error('清理过期审计日志失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 搜索日志\n   */\n  async search(keyword, filters = {}, pagination = {}) {\n    try {\n      return await this.query({ ...filters, keyword }, pagination);\n      \n    } catch (error) {\n      logger.error('搜索审计日志失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 获取系统行为模式分析\n   */\n  async getPatternAnalysis(timeRange = '30d') {\n    try {\n      const timeCondition = this.getTimeCondition(timeRange);\n      \n      // 用户行为模式\n      const userPatterns = await database.query(`\n        SELECT user_id, \n               COUNT(*) as activity_count,\n               COUNT(DISTINCT host_id) as unique_hosts,\n               COUNT(DISTINCT DATE(created_at)) as active_days,\n               AVG(CASE WHEN risk_level = 'critical' THEN 4 \n                        WHEN risk_level = 'high' THEN 3\n                        WHEN risk_level = 'medium' THEN 2\n                        ELSE 1 END) as avg_risk_score\n        FROM audit_logs \n        WHERE ${timeCondition} AND user_id IS NOT NULL\n        GROUP BY user_id\n        ORDER BY activity_count DESC\n      `);\n      \n      // 主机访问模式\n      const hostPatterns = await database.query(`\n        SELECT host_id,\n               COUNT(*) as access_count,\n               COUNT(DISTINCT user_id) as unique_users,\n               COUNT(DISTINCT action) as unique_actions,\n               MAX(created_at) as last_access\n        FROM audit_logs \n        WHERE ${timeCondition} AND host_id IS NOT NULL\n        GROUP BY host_id\n        ORDER BY access_count DESC\n      `);\n      \n      // 异常行为检测\n      const anomalies = await database.query(`\n        SELECT user_id, host_id, action, COUNT(*) as frequency\n        FROM audit_logs \n        WHERE ${timeCondition} \n          AND (risk_level IN ('high', 'critical') OR status = 'failed')\n        GROUP BY user_id, host_id, action\n        HAVING frequency > 5\n        ORDER BY frequency DESC\n      `);\n      \n      return {\n        userPatterns,\n        hostPatterns,\n        anomalies,\n        analysisTime: new Date().toISOString()\n      };\n      \n    } catch (error) {\n      logger.error('获取系统行为模式分析失败:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * 解析metadata字段\n   */\n  parseMetadata(metadata) {\n    try {\n      if (!metadata) return {};\n      if (typeof metadata === 'string') {\n        return JSON.parse(metadata);\n      }\n      return metadata;\n    } catch (error) {\n      logger.warn('解析metadata失败:', error);\n      return {};\n    }\n  }\n\n  /**\n   * 获取时间条件SQL\n   */\n  getTimeCondition(timeRange) {\n    const ranges = {\n      '1h': \"created_at >= datetime('now', '-1 hour')\",\n      '24h': \"created_at >= datetime('now', '-1 day')\",\n      '7d': \"created_at >= datetime('now', '-7 days')\",\n      '30d': \"created_at >= datetime('now', '-30 days')\",\n      '90d': \"created_at >= datetime('now', '-90 days')\"\n    };\n    \n    return ranges[timeRange] || ranges['7d'];\n  }\n\n  /**\n   * 转换为CSV格式\n   */\n  convertToCSV(logs) {\n    if (logs.length === 0) {\n      return '';\n    }\n    \n    const headers = [\n      'ID', '用户ID', '主机ID', '会话ID', '操作', '类别',\n      '命令', '结果', '状态', '风险等级', 'IP地址', '创建时间'\n    ];\n    \n    const rows = logs.map(log => [\n      log.id,\n      log.user_id || '',\n      log.host_id || '',\n      log.session_id || '',\n      log.action,\n      log.category,\n      log.command || '',\n      log.result || '',\n      log.status,\n      log.risk_level,\n      log.ip_address || '',\n      log.created_at\n    ]);\n    \n    const csvContent = [headers, ...rows]\n      .map(row => row.map(field => `\"${field}\"`).join(','))\n      .join('\\n');\n    \n    return csvContent;\n  }\n\n  /**\n   * 生成日志ID\n   */\n  generateLogId() {\n    return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);\n  }\n}\n\nmodule.exports = new AuditLogService();"