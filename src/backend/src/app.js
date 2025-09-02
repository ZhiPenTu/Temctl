const Koa = require('koa');
const cors = require('koa-cors');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const json = require('koa-json');
const helmet = require('koa-helmet');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const config = require('./config/config');
const logger_winston = require('./utils/logger');
const database = require('./utils/database');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// 创建Koa应用实例
const app = new Koa();

// 创建HTTP服务器
const server = http.createServer(app.callback());

// 创建Socket.IO实例
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST']
  }
});

// 全局错误处理
app.on('error', (err, ctx) => {
  logger_winston.error('应用错误:', {
    error: err.message,
    stack: err.stack,
    url: ctx ? ctx.url : 'unknown',
    method: ctx ? ctx.method : 'unknown'
  });
});

// 中间件配置
app.use(helmet()); // 安全头设置
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(bodyParser({
  jsonLimit: '10mb',
  textLimit: '10mb',
  formLimit: '10mb'
}));
app.use(json()); // JSON美化输出
app.use(logger()); // HTTP请求日志

// 自定义中间件
app.use(errorHandler); // 错误处理中间件

// 健康检查端点
app.use(async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.status = 200;
    ctx.body = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: require('../package.json').version
    };
    return;
  }
  await next();
});

// API路由
app.use(routes.routes());
app.use(routes.allowedMethods());

// Socket.IO连接处理
io.on('connection', (socket) => {
  logger_winston.info('Socket.IO客户端连接:', socket.id);
  
  // SSH终端连接
  socket.on('ssh:connect', async (data) => {
    try {
      logger_winston.info('SSH连接请求:', data.hostId);
      // SSH连接逻辑将在后续实现
      socket.emit('ssh:connected', { success: true });
    } catch (error) {
      logger_winston.error('SSH连接失败:', error);
      socket.emit('ssh:error', { error: error.message });
    }
  });
  
  // SSH命令执行
  socket.on('ssh:command', async (data) => {
    try {
      logger_winston.info('SSH命令执行:', data.command);
      // 命令执行逻辑将在后续实现
      socket.emit('ssh:output', { output: `命令执行: ${data.command}\n` });
    } catch (error) {
      logger_winston.error('SSH命令执行失败:', error);
      socket.emit('ssh:error', { error: error.message });
    }
  });
  
  // SSH断开连接
  socket.on('ssh:disconnect', async (data) => {
    try {
      logger_winston.info('SSH断开连接:', data.hostId);
      // 断开连接逻辑将在后续实现
      socket.emit('ssh:disconnected', { success: true });
    } catch (error) {
      logger_winston.error('SSH断开连接失败:', error);
      socket.emit('ssh:error', { error: error.message });
    }
  });
  
  // AI对话
  socket.on('ai:message', async (data) => {
    try {
      logger_winston.info('AI消息处理:', data.message);
      // AI对话逻辑将在后续实现
      socket.emit('ai:response', { 
        response: `AI回复: ${data.message}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger_winston.error('AI消息处理失败:', error);
      socket.emit('ai:error', { error: error.message });
    }
  });
  
  // 文件传输
  socket.on('ftp:upload', async (data) => {
    try {
      logger_winston.info('FTP上传请求:', data.fileName);
      // 文件上传逻辑将在后续实现
      socket.emit('ftp:progress', { progress: 0 });
      // 模拟进度更新
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        socket.emit('ftp:progress', { progress });
        if (progress >= 100) {
          clearInterval(interval);
          socket.emit('ftp:complete', { success: true });
        }
      }, 100);
    } catch (error) {
      logger_winston.error('FTP上传失败:', error);
      socket.emit('ftp:error', { error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    logger_winston.info('Socket.IO客户端断开连接:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || config.server.port;
const HOST = process.env.HOST || config.server.host;

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 初始化数据库
    logger_winston.info('正在初始化数据库...');
    await database.init();
    logger_winston.info('数据库初始化完成');
    
    // 启动HTTP服务器
    server.listen(PORT, HOST, () => {
      logger_winston.info(`Temctl后端服务已启动`);
      logger_winston.info(`HTTP服务器: http://${HOST}:${PORT}`);
      logger_winston.info(`Socket.IO服务器: ws://${HOST}:${PORT}`);
      logger_winston.info(`环境: ${config.env}`);
      logger_winston.info(`进程PID: ${process.pid}`);
    });
  } catch (error) {
    logger_winston.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();

// 优雅关闭处理
process.on('SIGTERM', async () => {
  logger_winston.info('收到SIGTERM信号，开始优雅关闭...');
  await database.close();
  server.close(() => {
    logger_winston.info('HTTP服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger_winston.info('收到SIGINT信号，开始优雅关闭...');
  await database.close();
  server.close(() => {
    logger_winston.info('HTTP服务器已关闭');
    process.exit(0);
  });
});

// 未捕获的异常处理
process.on('uncaughtException', (err) => {
  logger_winston.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger_winston.error('未处理的Promise拒绝:', {
    reason: reason,
    promise: promise
  });
});

module.exports = { app, server, io };