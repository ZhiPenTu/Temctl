const Router = require('koa-router');
const AuditLogService = require('../services/AuditLogService');
const database = require('../utils/database');
const logger = require('../utils/logger');
const router = new Router();

// 查询审计日志
router.get('/', async (ctx) => {
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
      keyword,
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      order = 'DESC'
    } = ctx.query;
    
    const filters = {
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
    };
    
    // 移除空值
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      orderBy,
      order
    };
    
    const result = await AuditLogService.query(filters, pagination);
    
    ctx.body = {
      success: true,
      data: result
    };
    
  } catch (error) {
    logger.error('查询审计日志失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '查询审计日志失败: ' + error.message };
  }
});

// 获取日志详情
router.get('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const log = await AuditLogService.getLogDetail(id);
    
    ctx.body = {
      success: true,
      data: log
    };
    
  } catch (error) {
    logger.error('获取日志详情失败:', error);
    ctx.status = 404;
    ctx.body = { success: false, message: error.message };
  }
});

// 创建审计日志
router.post('/', async (ctx) => {
  try {
    const logData = {
      ...ctx.request.body,
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.header['user-agent']
    };
    
    const logId = await AuditLogService.log(logData);
    
    ctx.body = {
      success: true,
      data: { logId },
      message: '审计日志创建成功'
    };
    
  } catch (error) {
    logger.error('创建审计日志失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量创建审计日志
router.post('/batch', async (ctx) => {
  try {
    const { logs } = ctx.request.body;
    
    if (!Array.isArray(logs) || logs.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '日志列表不能为空' };
      return;
    }
    
    if (logs.length > 100) {
      ctx.status = 400;
      ctx.body = { success: false, message: '批量创建最多支持100条日志' };
      return;
    }
    
    // 添加请求信息到每条日志
    const enrichedLogs = logs.map(log => ({
      ...log,
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.header['user-agent']
    }));
    
    const result = await AuditLogService.batchLog(enrichedLogs);
    
    ctx.body = {
      success: true,
      data: result,
      message: `成功创建${result.success}条日志，失败${result.failed}条`
    };
    
  } catch (error) {
    logger.error('批量创建审计日志失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量创建失败: ' + error.message };
  }
});

// 删除审计日志
router.delete('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    await AuditLogService.deleteLog(id);
    
    ctx.body = {
      success: true,
      message: '审计日志删除成功'
    };
    
  } catch (error) {
    logger.error('删除审计日志失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量删除审计日志
router.post('/batch-delete', async (ctx) => {
  try {
    const filters = ctx.request.body;
    
    const deletedCount = await AuditLogService.batchDelete(filters);
    
    ctx.body = {
      success: true,
      data: { deletedCount },
      message: `成功删除${deletedCount}条日志`
    };
    
  } catch (error) {
    logger.error('批量删除审计日志失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取审计统计
router.get('/statistics/:timeRange?', async (ctx) => {
  try {
    const { timeRange = '7d' } = ctx.params;
    
    const stats = await AuditLogService.getStatistics(timeRange);
    
    ctx.body = {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error('获取审计统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取统计失败: ' + error.message };
  }
});

// 搜索审计日志
router.post('/search', async (ctx) => {
  try {
    const { keyword, filters = {}, pagination = {} } = ctx.request.body;
    
    if (!keyword) {
      ctx.status = 400;
      ctx.body = { success: false, message: '搜索关键词不能为空' };
      return;
    }
    
    const result = await AuditLogService.search(keyword, filters, pagination);
    
    ctx.body = {
      success: true,
      data: result
    };
    
  } catch (error) {
    logger.error('搜索审计日志失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '搜索失败: ' + error.message };
  }
});

// 导出审计日志
router.post('/export', async (ctx) => {
  try {
    const { filters = {}, format = 'json' } = ctx.request.body;
    
    if (!['json', 'csv'].includes(format)) {
      ctx.status = 400;
      ctx.body = { success: false, message: '不支持的导出格式' };
      return;
    }
    
    const exportData = await AuditLogService.exportLogs(filters, format);
    
    // 设置响应头
    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'csv') {
      ctx.set('Content-Type', 'text/csv; charset=utf-8');
    } else {
      ctx.set('Content-Type', 'application/json; charset=utf-8');
    }
    
    ctx.body = exportData;
    
  } catch (error) {
    logger.error('导出审计日志失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '导出失败: ' + error.message };
  }
});

// 清理过期日志
router.post('/cleanup', async (ctx) => {
  try {
    const { retentionDays = 90 } = ctx.request.body;
    
    if (retentionDays < 1 || retentionDays > 365) {
      ctx.status = 400;
      ctx.body = { success: false, message: '保留天数必须在1-365天之间' };
      return;
    }
    
    const deletedCount = await AuditLogService.cleanup(retentionDays);
    
    ctx.body = {
      success: true,
      data: { deletedCount },
      message: `已清理${deletedCount}条过期日志`
    };
    
  } catch (error) {
    logger.error('清理过期日志失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '清理失败: ' + error.message };
  }
});

// 获取系统行为模式分析
router.get('/analysis/:timeRange?', async (ctx) => {
  try {
    const { timeRange = '30d' } = ctx.params;
    
    const analysis = await AuditLogService.getPatternAnalysis(timeRange);
    
    ctx.body = {
      success: true,
      data: analysis
    };
    
  } catch (error) {
    logger.error('获取系统行为模式分析失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取分析失败: ' + error.message };
  }
});

// 获取日志类别列表
router.get('/categories', async (ctx) => {
  try {
    const categories = Object.entries(AuditLogService.categories).map(([key, value]) => ({
      key,
      name: value
    }));
    
    ctx.body = {
      success: true,
      data: { categories }
    };
    
  } catch (error) {
    logger.error('获取日志类别列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取类别列表失败: ' + error.message };
  }
});

// 获取风险等级列表
router.get('/risk-levels', async (ctx) => {
  try {
    const riskLevels = Object.entries(AuditLogService.riskLevels).map(([key, value]) => ({
      key,
      name: value
    }));
    
    ctx.body = {
      success: true,
      data: { riskLevels }
    };
    
  } catch (error) {
    logger.error('获取风险等级列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取风险等级列表失败: ' + error.message };
  }
});

// 获取操作状态列表
router.get('/statuses', async (ctx) => {
  try {
    const statuses = Object.entries(AuditLogService.statuses).map(([key, value]) => ({
      key,
      name: value
    }));
    
    ctx.body = {
      success: true,
      data: { statuses }
    };
    
  } catch (error) {
    logger.error('获取操作状态列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取状态列表失败: ' + error.message };
  }
});

module.exports = router;