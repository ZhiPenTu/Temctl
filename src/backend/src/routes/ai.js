const Router = require('koa-router');
const AIService = require('../services/AIService');
const database = require('../utils/database');
const logger = require('../utils/logger');
const router = new Router();

// AI对话
router.post('/chat', async (ctx) => {
  try {
    const { message, sessionId, model, provider } = ctx.request.body;
    
    if (!message) {
      ctx.status = 400;
      ctx.body = { success: false, message: '消息内容不能为空' };
      return;
    }
    
    // 获取或创建AI会话
    let session;
    if (sessionId) {
      session = await database.get(
        'SELECT * FROM ai_conversations WHERE id = ?',
        [sessionId]
      );
    }
    
    if (!session) {
      // 创建新会话
      const result = await database.run(
        'INSERT INTO ai_conversations (title, model, provider, status) VALUES (?, ?, ?, ?)',
        [message.substring(0, 50) + '...', model || 'gpt-3.5-turbo', provider || 'openai', 'active']
      );
      
      session = await database.get(
        'SELECT * FROM ai_conversations WHERE id = ?',
        [result.id]
      );
    }
    
    // 保存用户消息
    await database.run(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [session.id, 'user', message]
    );
    
    // 获取会话历史
    const history = await database.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [session.id]
    );
    
    // 调用AI服务获取响应
    const response = await AIService.chat(message, {
      sessionId: session.id,
      model: session.model,
      provider: session.provider,
      history: history.slice(-20) // 只保留最近20条消息作为上下文
    });
    
    // 保存AI响应
    await database.run(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [session.id, 'assistant', response.content]
    );
    
    // 更新会话信息
    await database.run(
      'UPDATE ai_conversations SET message_count = message_count + 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [session.id]
    );
    
    ctx.body = {
      success: true,
      data: {
        sessionId: session.id,
        response: response.content,
        usage: response.usage
      }
    };
    
  } catch (error) {
    logger.error('AI对话处理失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '对话处理失败: ' + error.message };
  }
});

// 获取AI会话列表
router.get('/conversations', async (ctx) => {
  try {
    const { page = 1, limit = 20 } = ctx.query;
    const offset = (page - 1) * limit;
    
    const conversations = await database.query(
      'SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );
    
    const total = await database.get(
      'SELECT COUNT(*) as count FROM ai_conversations'
    );
    
    ctx.body = {
      success: true,
      data: {
        conversations,
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    
  } catch (error) {
    logger.error('获取AI会话列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取会话列表失败: ' + error.message };
  }
});

// 获取会话详情和消息历史
router.get('/conversations/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const conversation = await database.get(
      'SELECT * FROM ai_conversations WHERE id = ?',
      [id]
    );
    
    if (!conversation) {
      ctx.status = 404;
      ctx.body = { success: false, message: '会话不存在' };
      return;
    }
    
    const messages = await database.query(
      'SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );
    
    ctx.body = {
      success: true,
      data: {
        conversation,
        messages
      }
    };
    
  } catch (error) {
    logger.error('获取会话详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取会话详情失败: ' + error.message };
  }
});

// 删除AI会话
router.delete('/conversations/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    await database.transaction(async (db) => {
      // 删除会话消息
      await db.run('DELETE FROM ai_messages WHERE conversation_id = ?', [id]);
      // 删除会话
      await db.run('DELETE FROM ai_conversations WHERE id = ?', [id]);
    });
    
    ctx.body = { success: true, message: '会话删除成功' };
    
  } catch (error) {
    logger.error('删除AI会话失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '删除会话失败: ' + error.message };
  }
});

// 获取AI模型列表
router.get('/models', async (ctx) => {
  try {
    const models = await AIService.getAvailableModels();
    
    ctx.body = {
      success: true,
      data: { models }
    };
    
  } catch (error) {
    logger.error('获取AI模型列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取模型列表失败: ' + error.message };
  }
});

// 测试AI服务连接
router.post('/test-connection', async (ctx) => {
  try {
    const { provider, config } = ctx.request.body;
    
    const isAvailable = await AIService.testConnection(provider, config);
    
    ctx.body = {
      success: true,
      data: { available: isAvailable }
    };
    
  } catch (error) {
    logger.error('测试AI服务连接失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '连接测试失败: ' + error.message };
  }
});

// 获取使用统计
router.get('/stats', async (ctx) => {
  try {
    const stats = await AIService.getUsageStats();
    
    ctx.body = {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error('获取AI使用统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取统计信息失败: ' + error.message };
  }
});

module.exports = router;