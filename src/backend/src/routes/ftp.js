const Router = require('koa-router');
const router = new Router();

// FTP文件传输相关API将在后续实现
router.get('/transfers', async (ctx) => {
  ctx.body = { success: true, data: [], message: 'FTP传输API待实现' };
});

module.exports = router;