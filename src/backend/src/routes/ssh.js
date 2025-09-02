const Router = require('koa-router');
const SSHController = require('../controllers/SSHController');
const { authMiddleware } = require('../middleware/auth');

const router = new Router();

// 应用认证中间件（可选）
// router.use(authMiddleware);

// 建立SSH连接
router.post('/connect', SSHController.connect);

// 断开SSH连接
router.delete('/connections/:sessionToken', SSHController.disconnect);

// 执行SSH命令
router.post('/connections/:sessionToken/execute', SSHController.executeCommand);

// 获取连接信息
router.get('/connections/:sessionToken', SSHController.getConnection);

// 获取所有活动连接
router.get('/connections', SSHController.getActiveConnections);

// 获取主机连接
router.get('/hosts/:hostId/connections', SSHController.getHostConnections);

// 断开主机所有连接
router.delete('/hosts/:hostId/connections', SSHController.disconnectHost);

// 断开所有连接
router.delete('/connections', SSHController.disconnectAll);

// 获取连接统计
router.get('/stats', SSHController.getConnectionStats);

// 获取SSH会话历史
router.get('/sessions', SSHController.getSessionHistory);

// 测试SSH连接
router.post('/test', SSHController.testConnection);

module.exports = router;