const Router = require('koa-router');
const AuthService = require('../services/AuthService');
const database = require('../utils/database');
const logger = require('../utils/logger');
const router = new Router();

// 密码认证
router.post('/password', async (ctx) => {
  try {
    const { hostId, password, savePassword = false } = ctx.request.body;
    
    if (!hostId || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机ID和密码不能为空' };
      return;
    }
    
    const result = await AuthService.authenticateWithPassword(hostId, password, {
      savePassword
    });
    
    ctx.body = {
      success: true,
      data: result,
      message: '密码认证成功'
    };
    
  } catch (error) {
    logger.error('密码认证失败:', error);
    ctx.status = 401;
    ctx.body = { success: false, message: error.message };
  }
});

// 密钥认证
router.post('/key', async (ctx) => {
  try {
    const { hostId, privateKeyPath, privateKeyContent, passphrase, saveKey = false } = ctx.request.body;
    
    if (!hostId) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机ID不能为空' };
      return;
    }
    
    if (!privateKeyPath && !privateKeyContent) {
      ctx.status = 400;
      ctx.body = { success: false, message: '必须提供私钥文件路径或内容' };
      return;
    }
    
    const keyData = {
      privateKeyPath,
      privateKeyContent,
      passphrase
    };
    
    const result = await AuthService.authenticateWithKey(hostId, keyData, {
      saveKey
    });
    
    ctx.body = {
      success: true,
      data: result,
      message: '密钥认证成功'
    };
    
  } catch (error) {
    logger.error('密钥认证失败:', error);
    ctx.status = 401;
    ctx.body = { success: false, message: error.message };
  }
});

// 双因子认证
router.post('/2fa', async (ctx) => {
  try {
    const { hostId, password, privateKeyPath, privateKeyContent, passphrase, totpCode, save = false } = ctx.request.body;
    
    if (!hostId) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机ID不能为空' };
      return;
    }
    
    const authData = {
      password,
      privateKeyPath,
      privateKeyContent,
      passphrase,
      totpCode
    };
    
    const result = await AuthService.authenticateWith2FA(hostId, authData, {
      save
    });
    
    ctx.body = {
      success: true,
      data: result,
      message: '双因子认证成功'
    };
    
  } catch (error) {
    logger.error('双因子认证失败:', error);
    ctx.status = 401;
    ctx.body = { success: false, message: error.message };
  }
});

// 测试连接
router.post('/test', async (ctx) => {
  try {
    const { hostname, port = 22, username, authType, password, privateKeyPath, privateKeyContent, passphrase } = ctx.request.body;
    
    if (!hostname || !username || !authType) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机名、用户名和认证类型不能为空' };
      return;
    }
    
    // 构造临时主机信息用于测试
    const testHost = { hostname, port, username };
    
    let authConfig;
    
    if (authType === 'password') {
      if (!password) {
        ctx.status = 400;
        ctx.body = { success: false, message: '密码不能为空' };
        return;
      }
      authConfig = { type: 'password', password };
    } else if (authType === 'key') {
      if (!privateKeyPath && !privateKeyContent) {
        ctx.status = 400;
        ctx.body = { success: false, message: '必须提供私钥文件路径或内容' };
        return;
      }
      
      let privateKey;
      if (privateKeyContent) {
        privateKey = privateKeyContent;
      } else {
        // 这里需要读取文件内容
        try {
          const fs = require('fs').promises;
          privateKey = await fs.readFile(privateKeyPath, 'utf8');
        } catch (error) {
          ctx.status = 400;
          ctx.body = { success: false, message: `无法读取私钥文件: ${error.message}` };
          return;
        }
      }
      
      authConfig = { type: 'key', privateKey, passphrase };
    }
    
    const testResult = await AuthService.testSSHConnection(testHost, authConfig);
    
    ctx.body = {
      success: testResult.success,
      message: testResult.success ? '连接测试成功' : testResult.error
    };
    
  } catch (error) {
    logger.error('连接测试失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '连接测试失败: ' + error.message };
  }
});

// 获取保存的认证信息
router.get('/saved/:hostId', async (ctx) => {
  try {
    const { hostId } = ctx.params;
    
    const authInfo = await AuthService.getSavedAuthInfo(hostId);
    
    if (!authInfo) {
      ctx.status = 404;
      ctx.body = { success: false, message: '未找到认证信息' };
      return;
    }
    
    // 不返回敏感信息，只返回状态
    const safeAuthInfo = {
      hostId: authInfo.hostId,
      authType: authInfo.authType,
      username: authInfo.username,
      hasPassword: authInfo.hasPassword || false,
      hasKey: authInfo.hasKey || false,
      hasPassphrase: authInfo.hasPassphrase || false
    };
    
    ctx.body = {
      success: true,
      data: safeAuthInfo
    };
    
  } catch (error) {
    logger.error('获取认证信息失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取认证信息失败: ' + error.message };
  }
});

// 删除保存的认证信息
router.delete('/saved/:hostId', async (ctx) => {
  try {
    const { hostId } = ctx.params;
    
    await AuthService.deleteSavedAuthInfo(hostId);
    
    ctx.body = {
      success: true,
      message: '认证信息已删除'
    };
    
  } catch (error) {
    logger.error('删除认证信息失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '删除认证信息失败: ' + error.message };
  }
});

// 验证私钥格式
router.post('/validate-key', async (ctx) => {
  try {
    const { privateKey } = ctx.request.body;
    
    if (!privateKey) {
      ctx.status = 400;
      ctx.body = { success: false, message: '私钥内容不能为空' };
      return;
    }
    
    const isValid = AuthService.validatePrivateKey(privateKey);
    
    ctx.body = {
      success: true,
      data: {
        valid: isValid,
        message: isValid ? '私钥格式有效' : '私钥格式无效'
      }
    };
    
  } catch (error) {
    logger.error('验证私钥失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '验证私钥失败: ' + error.message };
  }
});

// 获取认证统计
router.get('/stats/:hostId?', async (ctx) => {
  try {
    const { hostId } = ctx.params;
    
    const stats = await AuthService.getAuthStats(hostId);
    
    ctx.body = {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error('获取认证统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取认证统计失败: ' + error.message };
  }
});

// 批量测试连接
router.post('/batch-test', async (ctx) => {
  try {
    const { hosts } = ctx.request.body;
    
    if (!Array.isArray(hosts) || hosts.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机列表不能为空' };
      return;
    }
    
    if (hosts.length > 10) {
      ctx.status = 400;
      ctx.body = { success: false, message: '批量测试最多支持10个主机' };
      return;
    }
    
    const results = [];
    
    for (const hostConfig of hosts) {
      try {
        const { hostId, hostname, port = 22, username, authType } = hostConfig;
        
        // 获取保存的认证信息
        const authInfo = await AuthService.getSavedAuthInfo(hostId);
        
        if (!authInfo) {
          results.push({
            hostId,
            hostname,
            success: false,
            error: '未找到保存的认证信息'
          });
          continue;
        }
        
        let authConfig;
        
        if (authInfo.authType === 'password' && authInfo.password) {
          authConfig = { type: 'password', password: authInfo.password };
        } else if (authInfo.authType === 'key' && authInfo.privateKey) {
          authConfig = { 
            type: 'key', 
            privateKey: authInfo.privateKey, 
            passphrase: authInfo.passphrase 
          };
        } else {
          results.push({
            hostId,
            hostname,
            success: false,
            error: '认证信息不完整'
          });
          continue;
        }
        
        const testResult = await AuthService.testSSHConnection({ hostname, port, username }, authConfig);
        
        results.push({
          hostId,
          hostname,
          success: testResult.success,
          error: testResult.error
        });
        
      } catch (error) {
        results.push({
          hostId: hostConfig.hostId,
          hostname: hostConfig.hostname,
          success: false,
          error: error.message
        });
      }
    }
    
    ctx.body = {
      success: true,
      data: { results }
    };
    
  } catch (error) {
    logger.error('批量测试连接失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量测试失败: ' + error.message };
  }
});

module.exports = router;