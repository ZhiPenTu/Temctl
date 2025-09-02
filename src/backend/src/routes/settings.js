const Router = require('koa-router');
const SettingsService = require('../services/SettingsService');
const logger = require('../utils/logger');
const router = new Router();

// 获取所有设置
router.get('/', async (ctx) => {
  try {
    const { category } = ctx.query;
    
    const settings = await SettingsService.getSettings(category);
    
    ctx.body = {
      success: true,
      data: settings
    };
    
  } catch (error) {
    logger.error('获取设置失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取设置失败: ' + error.message };
  }
});

// 获取单个设置
router.get('/:category/:key', async (ctx) => {
  try {
    const { category, key } = ctx.params;
    
    const value = await SettingsService.getSetting(category, key);
    
    if (value === null) {
      ctx.status = 404;
      ctx.body = { success: false, message: '设置不存在' };
      return;
    }
    
    ctx.body = {
      success: true,
      data: { value }
    };
    
  } catch (error) {
    logger.error('获取设置失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取设置失败: ' + error.message };
  }
});

// 设置单个值
router.post('/:category/:key', async (ctx) => {
  try {
    const { category, key } = ctx.params;
    const { value, encrypted = false } = ctx.request.body;
    
    await SettingsService.setSetting(category, key, value, encrypted);
    
    ctx.body = {
      success: true,
      message: '设置更新成功'
    };
    
  } catch (error) {
    logger.error('设置更新失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量更新设置
router.post('/batch', async (ctx) => {
  try {
    const settingsData = ctx.request.body;
    
    const result = await SettingsService.updateSettings(settingsData);
    
    ctx.body = {
      success: true,
      data: result,
      message: `成功更新${result.updated}个设置，失败${result.failed}个`
    };
    
  } catch (error) {
    logger.error('批量更新设置失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量更新失败: ' + error.message };
  }
});

// 删除设置
router.delete('/:category/:key', async (ctx) => {
  try {
    const { category, key } = ctx.params;
    
    await SettingsService.deleteSetting(category, key);
    
    ctx.body = {
      success: true,
      message: '设置删除成功'
    };
    
  } catch (error) {
    logger.error('删除设置失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: error.message };
  }
});

// 重置设置
router.post('/reset/:category?', async (ctx) => {
  try {
    const { category } = ctx.params;
    
    const result = await SettingsService.resetSettings(category);
    
    ctx.body = {
      success: true,
      data: result,
      message: `成功重置${result.reset}个设置`
    };
    
  } catch (error) {
    logger.error('重置设置失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '重置设置失败: ' + error.message };
  }
});

// 导出设置
router.post('/export', async (ctx) => {
  try {
    const { categories } = ctx.request.body;
    
    const exportData = await SettingsService.exportSettings(categories);
    
    // 设置响应头
    const filename = `settings_${new Date().toISOString().split('T')[0]}.json`;
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
    ctx.set('Content-Type', 'application/json; charset=utf-8');
    
    ctx.body = exportData;
    
  } catch (error) {
    logger.error('导出设置失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '导出设置失败: ' + error.message };
  }
});

// 导入设置
router.post('/import', async (ctx) => {
  try {
    const { importData, overwrite = false } = ctx.request.body;
    
    if (!importData) {
      ctx.status = 400;
      ctx.body = { success: false, message: '导入数据不能为空' };
      return;
    }
    
    const result = await SettingsService.importSettings(importData, overwrite);
    
    ctx.body = {
      success: true,
      data: result,
      message: `成功导入${result.imported}个设置，跳过${result.skipped}个，失败${result.failed}个`
    };
    
  } catch (error) {
    logger.error('导入设置失败:', error);
    ctx.status = 400;
    ctx.body = { success: false, message: '导入设置失败: ' + error.message };
  }
});

// 获取设置统计
router.get('/stats', async (ctx) => {
  try {
    const stats = await SettingsService.getSettingsStats();
    
    ctx.body = {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error('获取设置统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取设置统计失败: ' + error.message };
  }
});

// 获取设置分类列表
router.get('/categories', async (ctx) => {
  try {
    const categories = Object.entries(SettingsService.categories).map(([key, value]) => ({
      key,
      name: value
    }));
    
    ctx.body = {
      success: true,
      data: { categories }
    };
    
  } catch (error) {
    logger.error('获取设置分类列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取分类列表失败: ' + error.message };
  }
});

// 初始化设置
router.post('/initialize', async (ctx) => {
  try {
    await SettingsService.initialize();
    
    ctx.body = {
      success: true,
      message: '设置初始化成功'
    };
    
  } catch (error) {
    logger.error('初始化设置失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '初始化设置失败: ' + error.message };
  }
});

module.exports = router;