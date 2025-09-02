const Router = require('koa-router');
const router = new Router();

// 安全管控相关API将在后续实现
router.get('/rules', async (ctx) => {
  ctx.body = { success: true, data: [], message: '安全规则API待实现' };
});

module.exports = router;