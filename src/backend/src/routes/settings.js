const Router = require('koa-router');
const router = new Router();

// 设置管理相关API将在后续实现
router.get('/', async (ctx) => {
  ctx.body = { success: true, data: {}, message: '设置管理API待实现' };
});

module.exports = router;