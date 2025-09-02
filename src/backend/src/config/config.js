const path = require('path');

// 环境变量
const env = process.env.NODE_ENV || 'development';

// 基础配置
const config = {
  // 环境
  env,
  
  // 服务器配置
  server: {
    host: '127.0.0.1',
    port: 8081
  },
  
  // 跨域配置
  cors: {
    origin: env === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : false
  },
  
  // 数据库配置
  database: {
    sqlite: {
      path: path.join(__dirname, '../../data/temctl.db')
    }
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'temctl-jwt-secret-key-2025',
    expiresIn: '24h'
  },
  
  // 加密配置
  crypto: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    saltLength: 32
  },
  
  // SSH配置
  ssh: {
    timeout: 30000, // 30秒超时
    keepAliveInterval: 30000, // 30秒心跳
    maxConnections: 100 // 最大连接数
  },
  
  // FTP配置
  ftp: {
    timeout: 30000,
    maxConnections: 10
  },
  
  // AI配置
  ai: {
    openai: {
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      maxTokens: 2048,
      temperature: 0.7
    },
    local: {
      endpoint: 'http://localhost:11434',
      model: 'llama2'
    }
  },
  
  // 日志配置
  logging: {
    level: env === 'development' ? 'debug' : 'info',
    file: {
      enabled: true,
      path: path.join(__dirname, '../../logs'),
      maxFiles: 10,
      maxSize: '10m'
    },
    console: {
      enabled: env === 'development'
    }
  },
  
  // 安全配置
  security: {
    // 密码加密轮数
    bcryptRounds: 12,
    
    // 会话超时(分钟)
    sessionTimeout: 30,
    
    // 最大登录尝试次数
    maxLoginAttempts: 5,
    
    // 锁定时间(分钟)
    lockoutDuration: 15,
    
    // 审计日志保留天数
    auditLogRetention: 90
  },
  
  // 文件配置
  file: {
    // 上传限制
    uploadLimit: '100MB',
    
    // 允许的文件类型
    allowedTypes: [
      'text/*',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-shell'
    ],
    
    // 临时目录
    tempDir: path.join(__dirname, '../../temp'),
    
    // 存储目录
    storageDir: path.join(__dirname, '../../storage')
  }
};

// 环境特定配置
if (env === 'production') {
  // 生产环境配置
  config.server.host = process.env.HOST || '0.0.0.0';
  config.server.port = process.env.PORT || 8081;
  config.logging.level = 'info';
  config.logging.console.enabled = false;
} else if (env === 'test') {
  // 测试环境配置
  config.server.port = 8081;
  config.database.sqlite.path = ':memory:';
  config.logging.level = 'error';
  config.logging.file.enabled = false;
  config.logging.console.enabled = false;
}

module.exports = config;