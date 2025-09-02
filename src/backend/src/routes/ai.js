const Router = require('koa-router');
const router = new Router();

// AI对话相关API将在后续实现
router.post('/chat', async (ctx) => {
  ctx.body = { success: true, data: { response: 'AI聊天API待实现' } };
});

module.exports = router;