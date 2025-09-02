const Router = require('koa-router');
const hostsRouter = require('./hosts');
const sshRouter = require('./ssh');
const ftpRouter = require('./ftp');
const aiRouter = require('./ai');
const securityRouter = require('./security');
const logsRouter = require('./logs');
const settingsRouter = require('./settings');

const router = new Router({
  prefix: '/api'
});

// API版本信息
router.get('/', async (ctx) => {
  ctx.body = {
    name: 'Temctl API',
    version: '1.0.0',
    description: '跨平台AI终端工具后端API',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/hosts - 主机管理',
      '/api/ssh - SSH连接管理',
      '/api/ftp - 文件传输',
      '/api/ai - AI交互',
      '/api/security - 安全管控',
      '/api/logs - 操作日志',
      '/api/settings - 设置管理'
    ]
  };
});

// 挂载子路由
router.use('/hosts', hostsRouter.routes(), hostsRouter.allowedMethods());
router.use('/ssh', sshRouter.routes(), sshRouter.allowedMethods());
router.use('/ftp', ftpRouter.routes(), ftpRouter.allowedMethods());
router.use('/ai', aiRouter.routes(), aiRouter.allowedMethods());
router.use('/security', securityRouter.routes(), securityRouter.allowedMethods());
router.use('/logs', logsRouter.routes(), logsRouter.allowedMethods());
router.use('/settings', settingsRouter.routes(), settingsRouter.allowedMethods());

module.exports = router;