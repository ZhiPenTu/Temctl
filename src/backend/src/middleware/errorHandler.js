const logger = require('../utils/logger');

/**
 * 全局错误处理中间件
 */
module.exports = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // 记录错误日志
    logger.error('请求处理错误:', {
      error: err.message,
      stack: err.stack,
      method: ctx.method,
      url: ctx.url,
      headers: ctx.headers,
      body: ctx.request.body,
      query: ctx.query,
      params: ctx.params
    });

    // 设置错误状态码
    ctx.status = err.status || err.statusCode || 500;

    // 错误响应格式
    const errorResponse = {
      success: false,
      error: {
        message: err.message || '内部服务器错误',
        code: err.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      }
    };

    // 开发环境返回详细错误信息
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = err.stack;
      errorResponse.error.details = err.details || null;
    }

    // 根据错误类型设置不同的响应
    switch (ctx.status) {
      case 400:
        errorResponse.error.message = err.message || '请求参数错误';
        errorResponse.error.code = 'BAD_REQUEST';
        break;
      
      case 401:
        errorResponse.error.message = '未授权访问';
        errorResponse.error.code = 'UNAUTHORIZED';
        break;
      
      case 403:
        errorResponse.error.message = '禁止访问';
        errorResponse.error.code = 'FORBIDDEN';
        break;
      
      case 404:
        errorResponse.error.message = '资源未找到';
        errorResponse.error.code = 'NOT_FOUND';
        break;
      
      case 409:
        errorResponse.error.message = err.message || '资源冲突';
        errorResponse.error.code = 'CONFLICT';
        break;
      
      case 422:
        errorResponse.error.message = err.message || '数据验证失败';
        errorResponse.error.code = 'VALIDATION_ERROR';
        break;
      
      case 429:
        errorResponse.error.message = '请求过于频繁';
        errorResponse.error.code = 'TOO_MANY_REQUESTS';
        break;
      
      case 500:
      default:
        // 生产环境不暴露内部错误信息
        if (process.env.NODE_ENV === 'production') {
          errorResponse.error.message = '内部服务器错误';
        }
        errorResponse.error.code = 'INTERNAL_ERROR';
        break;
    }

    // 设置响应类型
    ctx.type = 'application/json';
    ctx.body = errorResponse;

    // 触发应用级错误事件
    ctx.app.emit('error', err, ctx);
  }
};