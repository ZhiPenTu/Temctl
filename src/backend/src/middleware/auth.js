const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * JWT认证中间件
 */
const authMiddleware = async (ctx, next) => {
  // 跳过认证的路径
  const skipPaths = [
    '/api',
    '/api/auth/login',
    '/api/auth/register',
    '/health'
  ];

  if (skipPaths.includes(ctx.path)) {
    return await next();
  }

  try {
    // 从请求头获取token
    const token = extractToken(ctx);
    
    if (!token) {
      ctx.throw(401, '缺少认证token');
    }

    // 验证token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // 检查token是否过期
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      ctx.throw(401, 'token已过期');
    }

    // 将用户信息添加到上下文
    ctx.state.user = decoded;
    
    // 记录认证日志
    logger.audit('用户认证成功', {
      userId: decoded.id,
      username: decoded.username,
      ip: ctx.ip,
      userAgent: ctx.headers['user-agent'],
      path: ctx.path,
      method: ctx.method
    });

    await next();
  } catch (error) {
    // 记录认证失败日志
    logger.audit('用户认证失败', {
      error: error.message,
      ip: ctx.ip,
      userAgent: ctx.headers['user-agent'],
      path: ctx.path,
      method: ctx.method
    });

    if (error.name === 'JsonWebTokenError') {
      ctx.throw(401, '无效的token');
    } else if (error.name === 'TokenExpiredError') {
      ctx.throw(401, 'token已过期');
    } else {
      throw error;
    }
  }
};

/**
 * 从请求中提取token
 */
function extractToken(ctx) {
  const authHeader = ctx.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // 也可以从query参数获取token (不推荐，仅用于特殊情况)
  return ctx.query.token || null;
}

/**
 * 权限检查中间件工厂
 */
const requireRole = (roles) => {
  return async (ctx, next) => {
    const user = ctx.state.user;
    
    if (!user) {
      ctx.throw(401, '用户未认证');
    }
    
    if (!roles.includes(user.role)) {
      logger.audit('权限检查失败', {
        userId: user.id,
        username: user.username,
        requiredRoles: roles,
        userRole: user.role,
        path: ctx.path,
        method: ctx.method
      });
      
      ctx.throw(403, '权限不足');
    }
    
    await next();
  };
};

/**
 * 可选认证中间件 (用于可选认证的接口)
 */
const optionalAuth = async (ctx, next) => {
  try {
    const token = extractToken(ctx);
    
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      ctx.state.user = decoded;
    }
  } catch (error) {
    // 可选认证失败不抛出错误，继续执行
    logger.debug('可选认证失败:', error.message);
  }
  
  await next();
};

/**
 * 生成JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * 验证token
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth,
  generateToken,
  verifyToken
};