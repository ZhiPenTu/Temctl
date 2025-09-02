const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// 确保日志目录存在
if (config.logging.file.enabled) {
  const logDir = config.logging.file.path;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// 创建transports数组
const transports = [];

// 控制台输出
if (config.logging.console.enabled) {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

// 文件输出
if (config.logging.file.enabled) {
  // 组合日志文件
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'combined.log'),
      level: 'info',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      handleExceptions: true,
      handleRejections: true
    })
  );
  
  // 错误日志文件
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles
    })
  );
  
  // SSH操作日志文件
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'ssh.log'),
      level: 'info',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles
    })
  );
  
  // AI交互日志文件
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'ai.log'),
      level: 'info',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles
    })
  );
  
  // 安全审计日志文件
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'audit.log'),
      level: 'info',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles
    })
  );
}

// 创建logger实例
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false
});

// 专用logger方法
const loggers = {
  // SSH操作日志
  ssh: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'SSH' });
  },
  
  // AI交互日志
  ai: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'AI' });
  },
  
  // 安全审计日志
  audit: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'AUDIT' });
  },
  
  // 文件传输日志
  ftp: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'FTP' });
  },
  
  // 数据库操作日志
  database: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'DATABASE' });
  },
  
  // API访问日志
  api: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'API' });
  },
  
  // 性能监控日志
  performance: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'PERFORMANCE' });
  }
};

// 扩展logger对象
Object.assign(logger, loggers);

// 错误捕获
if (config.env !== 'test') {
  // 捕获未处理的异常
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', {
      error: error.message,
      stack: error.stack
    });
  });
  
  // 捕获未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', {
      reason: reason,
      promise: promise
    });
  });
}

module.exports = logger;