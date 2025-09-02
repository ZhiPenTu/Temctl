const Router = require('koa-router');
const { Host, HostGroup } = require('../models');
const logger = require('../utils/logger');
const crypto = require('../utils/crypto');

const router = new Router();

// 获取主机列表
router.get('/', async (ctx) => {
  try {
    const { page = 1, pageSize = 20, groupId, status, search } = ctx.query;
    
    logger.api('获取主机列表请求', { page, pageSize, groupId, status, search });
    
    const hostModel = new Host();
    
    // 构建查询条件
    const options = {
      orderBy: 'updated_at DESC'
    };
    
    const where = {};
    
    if (groupId) {
      where.group_id = groupId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (Object.keys(where).length > 0) {
      options.where = where;
    }
    
    let result;
    
    if (search) {
      // 搜索模式
      const searchResults = await hostModel.search(search, { limit: parseInt(pageSize) });
      result = {
        items: searchResults,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: searchResults.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      };
    } else {
      // 分页查询
      result = await hostModel.paginate(parseInt(page), parseInt(pageSize), options);
    }
    
    ctx.body = {
      success: true,
      data: result.items,
      pagination: result.pagination
    };
  } catch (error) {
    logger.error('获取主机列表失败:', error);
    ctx.throw(500, '获取主机列表失败');
  }
});

// 创建主机
router.post('/', async (ctx) => {
  try {
    const hostData = ctx.request.body;
    logger.api('创建主机请求', { name: hostData.name, hostname: hostData.hostname });
    
    // 数据验证
    if (!hostData.name || !hostData.hostname || !hostData.username) {
      ctx.throw(400, '主机名、地址和用户名不能为空');
    }
    
    const hostModel = new Host();
    
    // 检查主机名是否已存在
    const existingHost = await hostModel.findOne({ name: hostData.name });
    if (existingHost) {
      ctx.throw(409, '主机名已存在');
    }
    
    // 处理敏感数据加密
    if (hostData.password) {
      hostData.encrypted_password = await crypto.encryptPassword(hostData.password);
      delete hostData.password; // 删除明文密码
    }
    
    // 处理标签
    if (hostData.tags && Array.isArray(hostData.tags)) {
      hostData.tags = JSON.stringify(hostData.tags);
    }
    
    // 创建主机
    const host = await hostModel.create(hostData);
    
    // 返回时不包含敏感信息
    const safeHost = { ...host };
    delete safeHost.encrypted_password;
    delete safeHost.private_key_path;
    
    ctx.body = {
      success: true,
      data: safeHost
    };
  } catch (error) {
    logger.error('创建主机失败:', error);
    if (error.status) {
      throw error;
    }
    ctx.throw(500, '创建主机失败');
  }
});

// 更新主机
router.put('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const updates = ctx.request.body;
    logger.api('更新主机请求', { id, updates: Object.keys(updates) });
    
    const hostModel = new Host();
    
    // 检查主机是否存在
    const existingHost = await hostModel.findById(id);
    if (!existingHost) {
      ctx.throw(404, '主机不存在');
    }
    
    // 处理敏感数据加密
    if (updates.password) {
      updates.encrypted_password = await crypto.encryptPassword(updates.password);
      delete updates.password;
    }
    
    // 处理标签
    if (updates.tags && Array.isArray(updates.tags)) {
      updates.tags = JSON.stringify(updates.tags);
    }
    
    // 更新主机
    const updatedHost = await hostModel.update(id, updates);
    
    // 返回时不包含敏感信息
    const safeHost = { ...updatedHost };
    delete safeHost.encrypted_password;
    delete safeHost.private_key_path;
    
    ctx.body = {
      success: true,
      data: safeHost
    };
  } catch (error) {
    logger.error('更新主机失败:', error);
    if (error.status) {
      throw error;
    }
    ctx.throw(500, '更新主机失败');
  }
});

// 获取单个主机信息
router.get('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    logger.api('获取主机信息请求', { id });
    
    const hostModel = new Host();
    const host = await hostModel.findById(id);
    
    if (!host) {
      ctx.throw(404, '主机不存在');
    }
    
    // 返回时不包含敏感信息
    const safeHost = { ...host };
    delete safeHost.encrypted_password;
    delete safeHost.private_key_path;
    
    // 解析标签
    if (safeHost.tags) {
      try {
        safeHost.tags = JSON.parse(safeHost.tags);
      } catch (e) {
        safeHost.tags = [];
      }
    }
    
    ctx.body = {
      success: true,
      data: safeHost
    };
  } catch (error) {
    logger.error('获取主机信息失败:', error);
    if (error.status) {
      throw error;
    }
    ctx.throw(500, '获取主机信息失败');
  }
});

// 删除主机
router.delete('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    logger.api('删除主机请求', { id });
    
    const hostModel = new Host();
    
    // 检查主机是否存在
    const existingHost = await hostModel.findById(id);
    if (!existingHost) {
      ctx.throw(404, '主机不存在');
    }
    
    // TODO: 检查是否有活动连接，如有则先断开
    
    // 删除主机
    await hostModel.delete(id);
    
    ctx.body = {
      success: true,
      message: '主机已删除'
    };
  } catch (error) {
    logger.error('删除主机失败:', error);
    if (error.status) {
      throw error;
    }
    ctx.throw(500, '删除主机失败');
  }
});

// 获取主机统计信息
router.get('/stats/overview', async (ctx) => {
  try {
    logger.api('获取主机统计信息请求');
    
    const hostModel = new Host();
    const stats = await hostModel.getStats();
    
    ctx.body = {
      success: true,
      data: stats
    };
  } catch (error) {
    logger.error('获取主机统计信息失败:', error);
    ctx.throw(500, '获取主机统计信息失败');
  }
});

// 获取主机分组
router.get('/groups', async (ctx) => {
  try {
    logger.api('获取主机分组请求');
    
    const groupModel = new HostGroup();
    const groups = await groupModel.getTree();
    
    ctx.body = {
      success: true,
      data: groups
    };
  } catch (error) {
    logger.error('获取主机分组失败:', error);
    ctx.throw(500, '获取主机分组失败');
  }
});

// 创建主机分组
router.post('/groups', async (ctx) => {
  try {
    const groupData = ctx.request.body;
    logger.api('创建主机分组请求', { name: groupData.name });
    
    if (!groupData.name) {
      ctx.throw(400, '分组名不能为空');
    }
    
    const groupModel = new HostGroup();
    const group = await groupModel.create(groupData);
    
    ctx.body = {
      success: true,
      data: group
    };
  } catch (error) {
    logger.error('创建主机分组失败:', error);
    if (error.status) {
      throw error;
    }
    ctx.throw(500, '创建主机分组失败');
  }
});

module.exports = router;