const Router = require('koa-router');
const router = new Router();

// 操作日志相关API将在后续实现
router.get('/', async (ctx) => {
  ctx.body = { success: true, data: [], message: '操作日志API待实现' };
});

module.exports = router;