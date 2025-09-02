const logger = require('../utils/logger');

/**
 * 安全管控服务
 * 实现命令审核、权限管理、安全规则等功能
 */
class SecurityService {
  constructor() {
    // 内置危险命令模式
    this.builtinDangerousPatterns = [
      { pattern: '^rm\\s+(-rf?\\s+)?/$', level: 'critical', description: '删除根目录' },
      { pattern: '^rm\\s+(-rf?\\s+)?/\\*$', level: 'critical', description: '删除根目录所有文件' },
      { pattern: '^sudo\\s+rm', level: 'high', description: 'sudo删除命令' }
    ];
    
    logger.info('安全管控服务已启动');
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
      
      // 检查内置危险模式
      for (const rule of this.builtinDangerousPatterns) {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(command)) {
          auditResult.violations.push({
            ruleId: 'builtin-' + rule.level,
            ruleName: rule.description,
            ruleType: 'pattern',
            severity: rule.level,
            action: rule.level === 'critical' ? 'block' : 'warn',
            description: rule.description,
            matchedContent: rule.pattern
          });
          
          if (rule.level === 'critical') {
            auditResult.allowed = false;
          }
          
          auditResult.riskLevel = rule.level;
        }
      }
      
      return auditResult;
      
    } catch (error) {
      logger.error('命令安全审核失败:', error);
      throw error;
    }
  }

  /**
   * 生成执行ID
   */
  generateExecutionId() {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  /**
   * 生成规则ID
   */
  generateRuleId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }
}

module.exports = new SecurityService();