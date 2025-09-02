const Router = require('koa-router');
const SecurityService = require('../services/SecurityService');
const database = require('../utils/database');
const logger = require('../utils/logger');
const router = new Router();

// 命令安全审核
router.post('/audit', async (ctx) => {
  try {
    const { command, hostId, sessionId } = ctx.request.body;
    
    if (!command) {
      ctx.status = 400;
      ctx.body = { success: false, message: '命令内容不能为空' };
      return;
    }
    
    const context = {
      hostId,
      sessionId,
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.header['user-agent']
    };
    
    const auditResult = await SecurityService.auditCommand(command, context);
    
    ctx.body = {
      success: true,
      data: auditResult
    };
    
  } catch (error) {
    logger.error('命令安全审核失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '安全审核失败: ' + error.message };
  }
});

// 创建安全规则
router.post('/rules', async (ctx) => {
  try {
    const ruleData = ctx.request.body;
    
    const rule = await SecurityService.createRule(ruleData);
    
    ctx.body = {
      success: true,
      data: rule,
      message: '安全规则创建成功'
    };
    
  } catch (error) {
    logger.error('创建安全规则失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取安全规则列表
router.get('/rules', async (ctx) => {
  try {
    const { type, severity, enabled } = ctx.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (severity) filters.severity = severity;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    
    const rules = await SecurityService.getRules(filters);
    
    ctx.body = {
      success: true,
      data: { rules }
    };
    
  } catch (error) {
    logger.error('获取安全规则列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取安全规则失败: ' + error.message };
  }
});

// 获取单个安全规则
router.get('/rules/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const rule = await database.get('SELECT * FROM security_rules WHERE id = ?', [id]);
    
    if (!rule) {
      ctx.status = 404;
      ctx.body = { success: false, message: '安全规则不存在' };
      return;
    }
    
    ctx.body = {
      success: true,
      data: rule
    };
    
  } catch (error) {
    logger.error('获取安全规则失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取安全规则失败: ' + error.message };
  }
});

// 更新安全规则
router.put('/rules/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const updateData = ctx.request.body;
    
    const rule = await SecurityService.updateRule(id, updateData);
    
    ctx.body = {
      success: true,
      data: rule,
      message: '安全规则更新成功'
    };
    
  } catch (error) {
    logger.error('更新安全规则失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除安全规则
router.delete('/rules/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    await SecurityService.deleteRule(id);
    
    ctx.body = {
      success: true,
      message: '安全规则删除成功'
    };
    
  } catch (error) {
    logger.error('删除安全规则失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量导入安全规则
router.post('/rules/import', async (ctx) => {
  try {
    const { rules } = ctx.request.body;
    
    if (!Array.isArray(rules) || rules.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '规则列表不能为空' };
      return;
    }
    
    const result = await SecurityService.importRules(rules);
    
    ctx.body = {
      success: true,
      data: result,
      message: `成功导入${result.imported}条规则，失败${result.failed}条`
    };
    
  } catch (error) {
    logger.error('批量导入安全规则失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量导入失败: ' + error.message };
  }
});

// 导出安全规则
router.get('/rules/export', async (ctx) => {
  try {
    const { type, severity, enabled } = ctx.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (severity) filters.severity = severity;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    
    const rules = await SecurityService.exportRules(filters);
    
    ctx.body = {
      success: true,
      data: { rules }
    };
    
  } catch (error) {
    logger.error('导出安全规则失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '导出安全规则失败: ' + error.message };
  }
});

// 测试安全规则
router.post('/rules/:id/test', async (ctx) => {
  try {
    const { id } = ctx.params;
    const { commands } = ctx.request.body;
    
    if (!Array.isArray(commands) || commands.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '测试命令列表不能为空' };
      return;
    }
    
    const result = await SecurityService.testRule(id, commands);
    
    ctx.body = {
      success: true,
      data: result
    };
    
  } catch (error) {
    logger.error('测试安全规则失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 启用/禁用安全规则
router.post('/rules/:id/toggle', async (ctx) => {
  try {
    const { id } = ctx.params;
    const { enabled } = ctx.request.body;
    
    if (typeof enabled !== 'boolean') {
      ctx.status = 400;
      ctx.body = { success: false, message: 'enabled参数必须为布尔值' };
      return;
    }
    
    const rule = await SecurityService.updateRule(id, { enabled });
    
    ctx.body = {
      success: true,
      data: rule,
      message: `安全规则已${enabled ? '启用' : '禁用'}`
    };
    
  } catch (error) {
    logger.error('切换安全规则状态失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取安全统计
router.get('/stats', async (ctx) => {
  try {
    const { hostId } = ctx.query;
    
    const stats = await SecurityService.getSecurityStats(hostId);
    
    ctx.body = {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error('获取安全统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取安全统计失败: ' + error.message };
  }
});

// 批量命令审核
router.post('/audit/batch', async (ctx) => {
  try {
    const { commands, hostId, sessionId } = ctx.request.body;
    
    if (!Array.isArray(commands) || commands.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '命令列表不能为空' };
      return;
    }
    
    if (commands.length > 20) {
      ctx.status = 400;
      ctx.body = { success: false, message: '批量审核最多支持20条命令' };
      return;
    }
    
    const context = {
      hostId,
      sessionId,
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.header['user-agent']
    };
    
    const results = [];
    
    for (const command of commands) {
      try {
        const auditResult = await SecurityService.auditCommand(command, context);
        results.push({
          command,
          success: true,
          result: auditResult
        });
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message
        });
      }
    }
    
    const summary = {
      total: commands.length,
      allowed: results.filter(r => r.success && r.result.allowed).length,
      blocked: results.filter(r => r.success && !r.result.allowed).length,
      errors: results.filter(r => !r.success).length
    };
    
    ctx.body = {
      success: true,
      data: {
        results,
        summary
      }
    };
    
  } catch (error) {
    logger.error('批量命令审核失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量审核失败: ' + error.message };
  }
});

// 获取安全事件列表
router.get('/events', async (ctx) => {
  try {
    const { hostId, riskLevel, status, page = 1, limit = 20 } = ctx.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM audit_logs WHERE category = "security"';
    const params = [];
    
    if (hostId) {
      query += ' AND host_id = ?';
      params.push(hostId);
    }
    
    if (riskLevel) {
      query += ' AND risk_level = ?';
      params.push(riskLevel);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const events = await database.query(query, params);
    
    let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE category = "security"';
    const countParams = [];
    let paramIndex = 0;
    
    if (hostId) {
      countQuery += paramIndex === 0 ? ' AND host_id = ?' : ' AND host_id = ?';
      countParams.push(hostId);
      paramIndex++;
    }
    
    if (riskLevel) {
      countQuery += paramIndex === 0 ? ' AND risk_level = ?' : ' AND risk_level = ?';
      countParams.push(riskLevel);
      paramIndex++;
    }
    
    if (status) {
      countQuery += paramIndex === 0 ? ' AND status = ?' : ' AND status = ?';
      countParams.push(status);
    }
    
    const total = await database.get(countQuery, countParams);
    
    ctx.body = {
      success: true,
      data: {
        events,
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    
  } catch (error) {
    logger.error('获取安全事件列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取安全事件失败: ' + error.message };
  }
});

module.exports = router;