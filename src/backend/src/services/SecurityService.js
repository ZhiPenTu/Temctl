const database = require('../utils/database');
const logger = require('../utils/logger');
const CommandTranslator = require('./CommandTranslator');

/**
 * 安全管控服务
 * 实现命令审核、权限管理、安全规则等功能
 */
class SecurityService {
  constructor() {
    // 内置危险命令模式
    this.builtinDangerousPatterns = [
      // 系统破坏性命令
      { pattern: '^rm\\s+(-rf?\\s+)?/$', level: 'critical', description: '删除根目录' },
      { pattern: '^rm\\s+(-rf?\\s+)?/\\*$', level: 'critical', description: '删除根目录所有文件' },
      { pattern: '^dd\\s+if=/dev/(zero|random)\\s+of=/dev/sd[a-z]', level: 'critical', description: '覆盖磁盘数据' },
      { pattern: '^mkfs', level: 'critical', description: '格式化文件系统' },
      { pattern: '^fdisk.*--delete', level: 'critical', description: '删除磁盘分区' },
      { pattern: ':(\\s*){\\s*:\\s*\\|\\s*:\\s*&\\s*}\\s*;\\s*:', level: 'critical', description: 'Fork炸弹' },
      
      // 权限提升
      { pattern: '^sudo\\s+rm', level: 'high', description: 'sudo删除命令' },
      { pattern: '^sudo\\s+chmod\\s+777\\s+/', level: 'high', description: 'sudo修改根目录权限' },
      { pattern: '^sudo\\s+chown.*root.*/', level: 'high', description: 'sudo修改根目录所有者' },
      
      // 网络安全
      { pattern: '^nc\\s+.*-e\\s+/bin/(bash|sh)', level: 'high', description: '反向Shell' },
      { pattern: '/bin/(bash|sh)\\s+.*>&\\s*/dev/tcp/', level: 'high', description: 'TCP反向连接' },
      { pattern: 'curl.*\\|\\s*(bash|sh)', level: 'medium', description: '下载并执行脚本' },
      { pattern: 'wget.*\\|\\s*(bash|sh)', level: 'medium', description: '下载并执行脚本' },
      
      // 数据泄露
      { pattern: 'cat\\s+/etc/(passwd|shadow)', level: 'medium', description: '查看敏感系统文件' },
      { pattern: 'find.*-name.*\\|\\s*xargs\\s+rm', level: 'medium', description: '批量删除文件' },
      
      // 恶意软件
      { pattern: 'python.*-c.*exec', level: 'medium', description: 'Python执行恶意代码' },
      { pattern: 'perl.*-e', level: 'low', description: 'Perl一句话执行' },
      { pattern: 'base64.*-d.*\\|.*sh', level: 'medium', description: 'Base64解码执行' }
    ];
    
    // 系统初始化时加载内置规则
    this.initBuiltinRules();
  }

  /**
   * 初始化内置安全规则
   */
  async initBuiltinRules() {
    try {
      for (const rule of this.builtinDangerousPatterns) {
        const existingRule = await database.get(
          'SELECT id FROM security_rules WHERE rule_content = ? AND type = "pattern"',
          [rule.pattern]
        );
        
        if (!existingRule) {
          await database.run(
            'INSERT INTO security_rules (id, name, type, rule_content, description, severity, action, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              this.generateRuleId(),
              `内置规则: ${rule.description}`,
              'pattern',
              rule.pattern,
              rule.description,
              rule.level,
              rule.level === 'critical' ? 'block' : 'warn',
              true
            ]
          );
        }
      }
      
      logger.info('内置安全规则初始化完成');
    } catch (error) {
      logger.error('初始化内置安全规则失败:', error);
    }
  }

  /**
   * 命令安全审核
   */
  async auditCommand(command, context = {}) {
    try {
      logger.info('开始命令安全审核:', { command, hostId: context.hostId });
      
      const auditResult = {
        command,
        allowed: true,
        riskLevel: 'low',
        violations: [],
        recommendations: [],
        executionId: this.generateExecutionId()
      };
      
      // 获取所有启用的安全规则
      const rules = await this.getEnabledRules();
      
      // 逐一检查规则
      for (const rule of rules) {
        const violation = await this.checkRule(command, rule);
        
        if (violation) {
          auditResult.violations.push(violation);
          
          // 根据规则动作决定是否阻止执行
          if (rule.action === 'block') {
            auditResult.allowed = false;
          }
          
          // 更新风险等级
          if (this.getRiskLevelValue(rule.severity) > this.getRiskLevelValue(auditResult.riskLevel)) {
            auditResult.riskLevel = rule.severity;
          }
        }
      }
      
      // 生成安全建议
      auditResult.recommendations = this.generateRecommendations(command, auditResult.violations);
      
      // 记录审核日志
      await this.logSecurityAudit(auditResult, context);
      
      return auditResult;
      
    } catch (error) {
      logger.error('命令安全审核失败:', error);
      throw error;
    }
  }

  /**
   * 检查单个安全规则
   */
  async checkRule(command, rule) {
    try {
      let matches = false;
      
      switch (rule.type) {
        case 'blacklist':
          // 黑名单：命令包含禁用的关键词
          const blacklistItems = rule.rule_content.split(',').map(s => s.trim());
          matches = blacklistItems.some(item => 
            command.toLowerCase().includes(item.toLowerCase())
          );
          break;
          
        case 'whitelist':
          // 白名单：命令不在允许列表中
          const whitelistItems = rule.rule_content.split(',').map(s => s.trim());
          matches = !whitelistItems.some(item => 
            command.toLowerCase().startsWith(item.toLowerCase())
          );
          break;
          
        case 'pattern':
          // 正则模式匹配
          const regex = new RegExp(rule.rule_content, 'i');
          matches = regex.test(command);
          break;
          
        case 'custom':
          // 自定义规则（可以扩展）
          matches = await this.evaluateCustomRule(command, rule);
          break;
      }
      
      if (matches) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.type,
          severity: rule.severity,
          action: rule.action,
          description: rule.description,
          matchedContent: rule.rule_content
        };
      }
      
      return null;
      
    } catch (error) {
      logger.error('检查安全规则失败:', error);
      return null;
    }
  }

  /**
   * 评估自定义规则
   */
  async evaluateCustomRule(command, rule) {
    // 这里可以实现更复杂的自定义规则逻辑
    // 例如：基于AI的恶意命令检测、上下文分析等
    return false;
  }

  /**
   * 获取所有启用的安全规则
   */
  async getEnabledRules() {
    try {
      return await database.query(
        'SELECT * FROM security_rules WHERE enabled = true ORDER BY severity DESC, created_at ASC'
      );
    } catch (error) {
      logger.error('获取安全规则失败:', error);
      return [];
    }
  }

  /**
   * 创建安全规则
   */
  async createRule(ruleData) {
    try {
      const {
        name,
        type,
        ruleContent,
        description = '',
        severity = 'medium',
        action = 'warn'
      } = ruleData;
      
      // 验证规则数据
      if (!name || !type || !ruleContent) {
        throw new Error('规则名称、类型和内容不能为空');
      }
      
      if (!['blacklist', 'whitelist', 'pattern', 'custom'].includes(type)) {
        throw new Error('无效的规则类型');
      }
      
      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        throw new Error('无效的严重程度');
      }
      
      if (!['block', 'warn', 'log'].includes(action)) {
        throw new Error('无效的规则动作');
      }
      
      // 如果是正则模式，验证正则表达式
      if (type === 'pattern') {
        try {
          new RegExp(ruleContent);
        } catch (error) {
          throw new Error('无效的正则表达式: ' + error.message);
        }
      }
      
      const ruleId = this.generateRuleId();
      
      await database.run(
        'INSERT INTO security_rules (id, name, type, rule_content, description, severity, action, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [ruleId, name, type, ruleContent, description, severity, action, true]
      );
      
      logger.info('安全规则创建成功:', ruleId);
      
      return {
        id: ruleId,
        name,
        type,
        ruleContent,
        description,
        severity,
        action,
        enabled: true
      };
      
    } catch (error) {
      logger.error('创建安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 更新安全规则
   */
  async updateRule(ruleId, updateData) {
    try {
      const existingRule = await database.get('SELECT * FROM security_rules WHERE id = ?', [ruleId]);
      if (!existingRule) {
        throw new Error('安全规则不存在');
      }
      
      const updateFields = [];
      const updateValues = [];
      
      if (updateData.name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(updateData.name);
      }
      
      if (updateData.ruleContent !== undefined) {
        // 如果是正则模式，验证正则表达式
        if (existingRule.type === 'pattern') {
          try {
            new RegExp(updateData.ruleContent);
          } catch (error) {
            throw new Error('无效的正则表达式: ' + error.message);
          }
        }
        updateFields.push('rule_content = ?');
        updateValues.push(updateData.ruleContent);
      }
      
      if (updateData.description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(updateData.description);
      }
      
      if (updateData.severity !== undefined) {
        if (!['low', 'medium', 'high', 'critical'].includes(updateData.severity)) {
          throw new Error('无效的严重程度');
        }
        updateFields.push('severity = ?');
        updateValues.push(updateData.severity);
      }
      
      if (updateData.action !== undefined) {
        if (!['block', 'warn', 'log'].includes(updateData.action)) {
          throw new Error('无效的规则动作');
        }
        updateFields.push('action = ?');
        updateValues.push(updateData.action);
      }
      
      if (updateData.enabled !== undefined) {
        updateFields.push('enabled = ?');
        updateValues.push(updateData.enabled);
      }
      
      if (updateFields.length === 0) {
        throw new Error('没有需要更新的字段');
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(ruleId);
      
      await database.run(
        `UPDATE security_rules SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      
      logger.info('安全规则更新成功:', ruleId);
      
      return await database.get('SELECT * FROM security_rules WHERE id = ?', [ruleId]);
      
    } catch (error) {
      logger.error('更新安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 删除安全规则
   */
  async deleteRule(ruleId) {
    try {
      const result = await database.run('DELETE FROM security_rules WHERE id = ?', [ruleId]);
      
      if (result.changes === 0) {
        throw new Error('安全规则不存在');
      }
      
      logger.info('安全规则删除成功:', ruleId);
      
    } catch (error) {
      logger.error('删除安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 获取安全规则列表
   */
  async getRules(filters = {}) {
    try {
      let query = 'SELECT * FROM security_rules';
      const params = [];
      const conditions = [];
      
      if (filters.type) {
        conditions.push('type = ?');
        params.push(filters.type);
      }
      
      if (filters.severity) {
        conditions.push('severity = ?');
        params.push(filters.severity);
      }
      
      if (filters.enabled !== undefined) {
        conditions.push('enabled = ?');
        params.push(filters.enabled);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY severity DESC, created_at ASC';
      
      return await database.query(query, params);
      
    } catch (error) {
      logger.error('获取安全规则列表失败:', error);
      throw error;
    }
  }

  /**
   * 批量导入安全规则
   */
  async importRules(rules) {
    try {
      const results = {
        imported: 0,
        failed: 0,
        errors: []
      };
      
      for (const ruleData of rules) {
        try {
          await this.createRule(ruleData);
          results.imported++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            rule: ruleData,
            error: error.message
          });
        }
      }
      
      logger.info('批量导入安全规则完成:', results);
      
      return results;
      
    } catch (error) {
      logger.error('批量导入安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 导出安全规则
   */
  async exportRules(filters = {}) {
    try {
      const rules = await this.getRules(filters);
      
      return rules.map(rule => ({
        name: rule.name,
        type: rule.type,
        ruleContent: rule.rule_content,
        description: rule.description,
        severity: rule.severity,
        action: rule.action,
        enabled: rule.enabled
      }));
      
    } catch (error) {
      logger.error('导出安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 测试安全规则
   */
  async testRule(ruleId, testCommands) {
    try {
      const rule = await database.get('SELECT * FROM security_rules WHERE id = ?', [ruleId]);
      if (!rule) {
        throw new Error('安全规则不存在');
      }
      
      const results = [];
      
      for (const command of testCommands) {
        const violation = await this.checkRule(command, rule);
        results.push({
          command,
          matched: !!violation,
          violation
        });
      }
      
      return {
        ruleId,
        ruleName: rule.name,
        testResults: results,
        matchedCount: results.filter(r => r.matched).length,
        totalCount: results.length
      };
      
    } catch (error) {
      logger.error('测试安全规则失败:', error);
      throw error;
    }
  }

  /**
   * 获取安全统计
   */
  async getSecurityStats(hostId = null) {
    try {
      const stats = {};
      
      // 规则统计
      const ruleStats = await database.query(`
        SELECT 
          type, severity, action, 
          COUNT(*) as count,
          SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as enabled_count
        FROM security_rules 
        GROUP BY type, severity, action
      `);
      
      stats.rules = {
        byType: {},
        bySeverity: {},
        byAction: {},
        total: 0,
        enabled: 0
      };
      
      for (const stat of ruleStats) {
        stats.rules.byType[stat.type] = (stats.rules.byType[stat.type] || 0) + stat.count;
        stats.rules.bySeverity[stat.severity] = (stats.rules.bySeverity[stat.severity] || 0) + stat.count;
        stats.rules.byAction[stat.action] = (stats.rules.byAction[stat.action] || 0) + stat.count;
        stats.rules.total += stat.count;
        stats.rules.enabled += stat.enabled_count;
      }
      
      // 审核统计
      let auditQuery = `
        SELECT 
          status, risk_level,
          COUNT(*) as count
        FROM audit_logs 
        WHERE category = 'security'
      `;
      
      const auditParams = [];
      
      if (hostId) {
        auditQuery += ' AND host_id = ?';
        auditParams.push(hostId);
      }
      
      auditQuery += ' GROUP BY status, risk_level';
      
      const auditStats = await database.query(auditQuery, auditParams);
      
      stats.audits = {
        byStatus: {},
        byRiskLevel: {},
        total: 0
      };
      
      for (const stat of auditStats) {
        stats.audits.byStatus[stat.status] = (stats.audits.byStatus[stat.status] || 0) + stat.count;
        stats.audits.byRiskLevel[stat.risk_level] = (stats.audits.byRiskLevel[stat.risk_level] || 0) + stat.count;
        stats.audits.total += stat.count;
      }
      
      // 最近违规趋势
      let trendQuery = `
        SELECT 
          DATE(created_at) as date,
          status,
          COUNT(*) as count
        FROM audit_logs 
        WHERE category = 'security' 
          AND created_at >= datetime('now', '-7 days')
      `;
      
      if (hostId) {
        trendQuery += ' AND host_id = ?';
      }
      
      trendQuery += ' GROUP BY DATE(created_at), status ORDER BY date';
      
      const trendStats = await database.query(trendQuery, hostId ? [hostId] : []);
      stats.trends = trendStats;
      
      return stats;
      
    } catch (error) {
      logger.error('获取安全统计失败:', error);
      throw error;
    }
  }

  /**
   * 记录安全审核日志
   */
  async logSecurityAudit(auditResult, context = {}) {
    try {
      await database.run(
        'INSERT INTO audit_logs (host_id, session_id, action, category, command, result, status, risk_level, ip_address, user_agent, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          context.hostId || null,
          context.sessionId || null,
          'command_audit',
          'security',
          auditResult.command,
          auditResult.allowed ? 'allowed' : 'blocked',
          auditResult.allowed ? 'success' : 'blocked',
          auditResult.riskLevel,
          context.ipAddress || null,
          context.userAgent || null,
          JSON.stringify({
            executionId: auditResult.executionId,
            violations: auditResult.violations,
            recommendations: auditResult.recommendations
          })
        ]
      );
    } catch (error) {
      logger.error('记录安全审核日志失败:', error);
    }
  }

  /**
   * 生成安全建议
   */
  generateRecommendations(command, violations) {
    const recommendations = [];
    
    if (violations.length === 0) {
      return recommendations;
    }
    
    // 基于违规类型生成建议
    const hasHighRisk = violations.some(v => ['high', 'critical'].includes(v.severity));
    const hasPatternMatch = violations.some(v => v.ruleType === 'pattern');
    const hasBlacklist = violations.some(v => v.ruleType === 'blacklist');
    
    if (hasHighRisk) {
      recommendations.push('检测到高风险命令，建议仔细确认命令的安全性');
      recommendations.push('考虑使用更安全的替代命令');
    }
    
    if (hasPatternMatch) {
      recommendations.push('命令匹配了危险模式，请确认是否为预期操作');
    }
    
    if (hasBlacklist) {
      recommendations.push('命令包含被禁止的关键词，请检查命令内容');
    }
    
    // 根据命令内容生成特定建议
    if (command.includes('rm')) {
      recommendations.push('删除操作具有不可逆性，建议先备份重要文件');
    }
    
    if (command.includes('sudo')) {
      recommendations.push('管理员权限操作风险较高，请确保操作的必要性');
    }
    
    if (command.includes('|') || command.includes(';')) {
      recommendations.push('复合命令可能产生意外结果，建议分步执行');
    }
    
    return recommendations;
  }

  /**
   * 获取风险等级数值
   */
  getRiskLevelValue(level) {
    const levels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    return levels[level] || 0;
  }

  /**
   * 生成规则ID
   */
  generateRuleId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 生成执行ID
   */
  generateExecutionId() {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = new SecurityService();