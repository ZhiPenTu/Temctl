const Router = require('koa-router');
const CommandTranslator = require('../services/CommandTranslator');
const database = require('../utils/database');
const logger = require('../utils/logger');
const router = new Router();

// 自然语言转命令
router.post('/translate', async (ctx) => {
  try {
    const { text, model, provider, sessionId } = ctx.request.body;
    
    if (!text) {
      ctx.status = 400;
      ctx.body = { success: false, message: '输入文本不能为空' };
      return;
    }
    
    // 执行命令转换
    const result = await CommandTranslator.translateToCommand(text, {
      model,
      provider,
      sessionId
    });
    
    if (result.success) {
      // 记录转换历史
      try {
        await database.run(
          'INSERT INTO command_history (original_text, translated_command, method, confidence, session_id) VALUES (?, ?, ?, ?, ?)',
          [text, result.command, result.method, result.confidence, sessionId]
        );
      } catch (dbError) {
        logger.error('保存命令转换历史失败:', dbError);
      }
    }
    
    ctx.body = {
      success: result.success,
      data: result.success ? {
        command: result.command,
        description: result.description,
        method: result.method,
        confidence: result.confidence
      } : null,
      error: result.error,
      suggestions: result.suggestions
    };
    
  } catch (error) {
    logger.error('命令转换失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '命令转换失败: ' + error.message };
  }
});

// 验证命令
router.post('/validate', async (ctx) => {
  try {
    const { command } = ctx.request.body;
    
    if (!command) {
      ctx.status = 400;
      ctx.body = { success: false, message: '命令不能为空' };
      return;
    }
    
    const validation = CommandTranslator.validateCommand(command);
    
    ctx.body = {
      success: true,
      data: validation
    };
    
  } catch (error) {
    logger.error('命令验证失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '命令验证失败: ' + error.message };
  }
});

// 获取支持的命令类型
router.get('/supported', async (ctx) => {
  try {
    const commands = CommandTranslator.getSupportedCommands();
    
    ctx.body = {
      success: true,
      data: { commands }
    };
    
  } catch (error) {
    logger.error('获取支持的命令类型失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取命令类型失败: ' + error.message };
  }
});

// 获取命令转换历史
router.get('/history', async (ctx) => {
  try {
    const { page = 1, limit = 20, sessionId } = ctx.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM command_history';
    let params = [];
    
    if (sessionId) {
      query += ' WHERE session_id = ?';
      params.push(sessionId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const history = await database.query(query, params);
    
    let countQuery = 'SELECT COUNT(*) as count FROM command_history';
    let countParams = [];
    
    if (sessionId) {
      countQuery += ' WHERE session_id = ?';
      countParams.push(sessionId);
    }
    
    const total = await database.get(countQuery, countParams);
    
    ctx.body = {
      success: true,
      data: {
        history,
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    
  } catch (error) {
    logger.error('获取命令转换历史失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取转换历史失败: ' + error.message };
  }
});

// 删除转换历史
router.delete('/history/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const result = await database.run(
      'DELETE FROM command_history WHERE id = ?',
      [id]
    );
    
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { success: false, message: '转换记录不存在' };
      return;
    }
    
    ctx.body = { success: true, message: '删除成功' };
    
  } catch (error) {
    logger.error('删除转换历史失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '删除失败: ' + error.message };
  }
});

// 批量转换命令
router.post('/batch-translate', async (ctx) => {
  try {
    const { texts, model, provider } = ctx.request.body;
    
    if (!Array.isArray(texts) || texts.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '输入文本数组不能为空' };
      return;
    }
    
    if (texts.length > 10) {
      ctx.status = 400;
      ctx.body = { success: false, message: '批量转换最多支持10条命令' };
      return;
    }
    
    const results = [];
    
    for (const text of texts) {
      try {
        const result = await CommandTranslator.translateToCommand(text, {
          model,
          provider
        });
        
        results.push({
          text,
          success: result.success,
          command: result.command,
          description: result.description,
          method: result.method,
          confidence: result.confidence,
          error: result.error
        });
        
      } catch (error) {
        results.push({
          text,
          success: false,
          error: error.message
        });
      }
    }
    
    ctx.body = {
      success: true,
      data: { results }
    };
    
  } catch (error) {
    logger.error('批量命令转换失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量转换失败: ' + error.message };
  }
});

// 获取转换统计
router.get('/stats', async (ctx) => {
  try {
    const stats = {};
    
    // 总转换次数
    const total = await database.get(
      'SELECT COUNT(*) as count FROM command_history'
    );
    stats.totalTranslations = total.count;
    
    // 成功率统计
    const successful = await database.get(
      'SELECT COUNT(*) as count FROM command_history WHERE translated_command IS NOT NULL AND translated_command != ""'
    );
    stats.successRate = total.count > 0 ? (successful.count / total.count * 100).toFixed(2) : 0;
    
    // 转换方法统计
    const methodStats = await database.query(
      'SELECT method, COUNT(*) as count FROM command_history WHERE method IS NOT NULL GROUP BY method'
    );
    stats.methodDistribution = methodStats;
    
    // 最常用的命令类型
    const commandStats = await database.query(
      'SELECT translated_command, COUNT(*) as count FROM command_history WHERE translated_command IS NOT NULL GROUP BY translated_command ORDER BY count DESC LIMIT 10'
    );
    stats.popularCommands = commandStats;
    
    // 近期转换趋势 (最近7天)
    const recentStats = await database.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM command_history 
      WHERE created_at >= datetime('now', '-7 days') 
      GROUP BY DATE(created_at) 
      ORDER BY date
    `);
    stats.recentTrend = recentStats;
    
    ctx.body = {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error('获取转换统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取统计信息失败: ' + error.message };
  }
});

module.exports = router;