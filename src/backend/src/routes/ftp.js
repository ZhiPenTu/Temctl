const Router = require('koa-router');
const FileTransferService = require('../services/FileTransferService');
const database = require('../utils/database');
const logger = require('../utils/logger');
const router = new Router();

// 开始文件上传
router.post('/upload', async (ctx) => {
  try {
    const { hostId, localPath, remotePath, checksum = false } = ctx.request.body;
    
    if (!hostId || !localPath || !remotePath) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机ID、本地路径和远程路径不能为空' };
      return;
    }
    
    const result = await FileTransferService.uploadFile(hostId, localPath, remotePath, {
      checksum,
      protocol: 'sftp'
    });
    
    ctx.body = {
      success: true,
      data: result,
      message: '文件上传已开始'
    };
    
  } catch (error) {
    logger.error('文件上传失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '文件上传失败: ' + error.message };
  }
});

// 开始文件下载
router.post('/download', async (ctx) => {
  try {
    const { hostId, remotePath, localPath, checksum = false } = ctx.request.body;
    
    if (!hostId || !remotePath || !localPath) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机ID、远程路径和本地路径不能为空' };
      return;
    }
    
    const result = await FileTransferService.downloadFile(hostId, remotePath, localPath, {
      checksum,
      protocol: 'sftp'
    });
    
    ctx.body = {
      success: true,
      data: result,
      message: '文件下载已开始'
    };
    
  } catch (error) {
    logger.error('文件下载失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '文件下载失败: ' + error.message };
  }
});

// 批量传输
router.post('/batch', async (ctx) => {
  try {
    const { hostId, transfers, checksum = false } = ctx.request.body;
    
    if (!hostId || !Array.isArray(transfers) || transfers.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '主机ID和传输任务列表不能为空' };
      return;
    }
    
    const result = await FileTransferService.batchTransfer(hostId, transfers, {
      checksum,
      protocol: 'sftp'
    });
    
    ctx.body = {
      success: true,
      data: result,
      message: '批量传输已开始'
    };
    
  } catch (error) {
    logger.error('批量传输失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '批量传输失败: ' + error.message };
  }
});

// 获取传输列表
router.get('/transfers', async (ctx) => {
  try {
    const { hostId, page = 1, limit = 20, status } = ctx.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM file_transfers';
    const params = [];
    const conditions = [];
    
    if (hostId) {
      conditions.push('host_id = ?');
      params.push(hostId);
    }
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const transfers = await database.query(query, params);
    
    let countQuery = 'SELECT COUNT(*) as count FROM file_transfers';
    let countParams = [];
    
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      countParams = params.slice(0, -2); // 移除limit和offset参数
    }
    
    const total = await database.get(countQuery, countParams);
    
    // 合并活动传输状态
    const activeTransfers = FileTransferService.getActiveTransfers();
    const activeTransferMap = new Map(activeTransfers.map(t => [t.id, t]));
    
    const enrichedTransfers = transfers.map(transfer => {
      const activeTransfer = activeTransferMap.get(transfer.id);
      if (activeTransfer) {
        return { ...transfer, ...activeTransfer };
      }
      return transfer;
    });
    
    ctx.body = {
      success: true,
      data: {
        transfers: enrichedTransfers,
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    
  } catch (error) {
    logger.error('获取传输列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取传输列表失败: ' + error.message };
  }
});

// 获取传输详情
router.get('/transfers/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    // 先从活动传输中查找
    let transfer = FileTransferService.getTransferStatus(id);
    
    // 如果不在活动传输中，从数据库查找
    if (!transfer) {
      transfer = await database.get('SELECT * FROM file_transfers WHERE id = ?', [id]);
    }
    
    if (!transfer) {
      ctx.status = 404;
      ctx.body = { success: false, message: '传输任务不存在' };
      return;
    }
    
    ctx.body = {
      success: true,
      data: transfer
    };
    
  } catch (error) {
    logger.error('获取传输详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取传输详情失败: ' + error.message };
  }
});

// 暂停传输
router.post('/transfers/:id/pause', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const success = await FileTransferService.pauseTransfer(id);
    
    if (!success) {
      ctx.status = 404;
      ctx.body = { success: false, message: '传输任务不存在或无法暂停' };
      return;
    }
    
    ctx.body = {
      success: true,
      message: '传输已暂停'
    };
    
  } catch (error) {
    logger.error('暂停传输失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '暂停传输失败: ' + error.message };
  }
});

// 恢复传输
router.post('/transfers/:id/resume', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const success = await FileTransferService.resumeTransfer(id);
    
    if (!success) {
      ctx.status = 404;
      ctx.body = { success: false, message: '传输任务不存在或无法恢复' };
      return;
    }
    
    ctx.body = {
      success: true,
      message: '传输已恢复'
    };
    
  } catch (error) {
    logger.error('恢复传输失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '恢复传输失败: ' + error.message };
  }
});

// 取消传输
router.post('/transfers/:id/cancel', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    const success = await FileTransferService.cancelTransfer(id);
    
    if (!success) {
      ctx.status = 404;
      ctx.body = { success: false, message: '传输任务不存在或无法取消' };
      return;
    }
    
    ctx.body = {
      success: true,
      message: '传输已取消'
    };
    
  } catch (error) {
    logger.error('取消传输失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '取消传输失败: ' + error.message };
  }
});

// 删除传输记录
router.delete('/transfers/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    // 先取消活动传输（如果存在）
    await FileTransferService.cancelTransfer(id);
    
    // 删除数据库记录
    const result = await database.run('DELETE FROM file_transfers WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { success: false, message: '传输记录不存在' };
      return;
    }
    
    ctx.body = {
      success: true,
      message: '传输记录已删除'
    };
    
  } catch (error) {
    logger.error('删除传输记录失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '删除传输记录失败: ' + error.message };
  }
});

// 获取活动传输
router.get('/active', async (ctx) => {
  try {
    const activeTransfers = FileTransferService.getActiveTransfers();
    
    ctx.body = {
      success: true,
      data: {
        transfers: activeTransfers,
        count: activeTransfers.length
      }
    };
    
  } catch (error) {
    logger.error('获取活动传输失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取活动传输失败: ' + error.message };
  }
});

// 清理过期传输记录
router.post('/cleanup', async (ctx) => {
  try {
    const { days = 30 } = ctx.request.body;
    
    const deletedCount = await FileTransferService.cleanupExpiredTransfers(days);
    
    ctx.body = {
      success: true,
      data: {
        deletedCount,
        message: `已清理${deletedCount}条过期传输记录`
      }
    };
    
  } catch (error) {
    logger.error('清理传输记录失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '清理传输记录失败: ' + error.message };
  }
});

// 获取传输统计
router.get('/stats', async (ctx) => {
  try {
    const { hostId } = ctx.query;
    
    let query = 'SELECT status, COUNT(*) as count, SUM(file_size) as total_size, AVG(transfer_speed) as avg_speed FROM file_transfers';
    const params = [];
    
    if (hostId) {
      query += ' WHERE host_id = ?';
      params.push(hostId);
    }
    
    query += ' GROUP BY status';
    
    const statusStats = await database.query(query, params);
    
    // 获取最近传输趋势
    let trendQuery = `
      SELECT DATE(created_at) as date, COUNT(*) as count, status
      FROM file_transfers 
      WHERE created_at >= datetime('now', '-7 days')
    `;
    
    if (hostId) {
      trendQuery += ' AND host_id = ?';
    }
    
    trendQuery += ' GROUP BY DATE(created_at), status ORDER BY date';
    
    const trendStats = await database.query(trendQuery, hostId ? [hostId] : []);
    
    // 获取活动传输统计
    const activeTransfers = FileTransferService.getActiveTransfers();
    const activeStats = {
      total: activeTransfers.length,
      uploading: activeTransfers.filter(t => t.type === 'upload' && t.status === 'transferring').length,
      downloading: activeTransfers.filter(t => t.type === 'download' && t.status === 'transferring').length,
      paused: activeTransfers.filter(t => t.status === 'paused').length
    };
    
    ctx.body = {
      success: true,
      data: {
        statusStats,
        trendStats,
        activeStats,
        summary: {
          total: statusStats.reduce((sum, stat) => sum + stat.count, 0),
          completed: statusStats.find(s => s.status === 'completed')?.count || 0,
          failed: statusStats.find(s => s.status === 'failed')?.count || 0,
          active: activeStats.total
        }
      }
    };
    
  } catch (error) {
    logger.error('获取传输统计失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取传输统计失败: ' + error.message };
  }
});

module.exports = router;