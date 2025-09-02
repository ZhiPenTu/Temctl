const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * 主机分组模型
 */
class HostGroup extends BaseModel {
  constructor() {
    super('host_groups');
  }

  /**
   * 获取分组树形结构
   */
  async getTree() {
    try {
      const allGroups = await this.findAll({
        orderBy: 'sort_order, name'
      });

      // 构建树形结构
      const groupMap = new Map();
      const rootGroups = [];

      // 先创建所有节点的映射
      allGroups.forEach(group => {
        groupMap.set(group.id, { ...group, children: [] });
      });

      // 构建父子关系
      allGroups.forEach(group => {
        const groupNode = groupMap.get(group.id);
        if (group.parent_id && groupMap.has(group.parent_id)) {
          groupMap.get(group.parent_id).children.push(groupNode);
        } else {
          rootGroups.push(groupNode);
        }
      });

      return rootGroups;
    } catch (error) {
      logger.error('获取分组树形结构失败:', error);
      throw error;
    }
  }

  /**
   * 获取分组及其子分组
   */
  async getGroupWithChildren(groupId) {
    try {
      const sql = `
        WITH RECURSIVE group_tree(id, name, description, color, parent_id, level) AS (
          SELECT id, name, description, color, parent_id, 0 as level
          FROM host_groups WHERE id = ?
          UNION ALL
          SELECT hg.id, hg.name, hg.description, hg.color, hg.parent_id, gt.level + 1
          FROM host_groups hg
          INNER JOIN group_tree gt ON hg.parent_id = gt.id
        )
        SELECT * FROM group_tree ORDER BY level, name
      `;

      return await this.rawQuery(sql, [groupId]);
    } catch (error) {
      logger.error('获取分组及子分组失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否可以删除分组（没有主机和子分组）
   */
  async canDelete(groupId) {
    try {
      // 检查是否有子分组
      const childGroups = await this.count({ parent_id: groupId });
      if (childGroups > 0) {
        return { canDelete: false, reason: '存在子分组' };
      }

      // 检查是否有主机
      const hostCount = await this.rawQuery(
        'SELECT COUNT(*) as count FROM hosts WHERE group_id = ?',
        [groupId]
      );

      if (hostCount[0].count > 0) {
        return { canDelete: false, reason: '存在关联主机' };
      }

      return { canDelete: true };
    } catch (error) {
      logger.error('检查分组删除权限失败:', error);
      throw error;
    }
  }
}

/**
 * 主机模型
 */
class Host extends BaseModel {
  constructor() {
    super('hosts');
  }

  /**
   * 根据分组查找主机
   */
  async findByGroup(groupId) {
    try {
      return await this.findAll({
        where: { group_id: groupId },
        orderBy: 'name'
      });
    } catch (error) {
      logger.error('根据分组查找主机失败:', error);
      throw error;
    }
  }

  /**
   * 搜索主机
   */
  async search(keyword, options = {}) {
    try {
      const sql = `
        SELECT h.*, hg.name as group_name
        FROM hosts h
        LEFT JOIN host_groups hg ON h.group_id = hg.id
        WHERE h.name LIKE ? OR h.hostname LIKE ? OR h.description LIKE ?
        ORDER BY h.name
        ${options.limit ? `LIMIT ${options.limit}` : ''}
      `;

      const searchPattern = `%${keyword}%`;
      return await this.rawQuery(sql, [searchPattern, searchPattern, searchPattern]);
    } catch (error) {
      logger.error('搜索主机失败:', error);
      throw error;
    }
  }

  /**
   * 更新连接状态
   */
  async updateConnectionStatus(hostId, status) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'connected') {
        updateData.last_connected_at = new Date().toISOString();
        // 增加连接次数
        const host = await this.findById(hostId);
        if (host) {
          updateData.connection_count = (host.connection_count || 0) + 1;
        }
      }

      return await this.update(hostId, updateData);
    } catch (error) {
      logger.error('更新连接状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取主机统计信息
   */
  async getStats() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected,
          SUM(CASE WHEN status = 'disconnected' THEN 1 ELSE 0 END) as disconnected,
          SUM(CASE WHEN status = 'connecting' THEN 1 ELSE 0 END) as connecting,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
        FROM hosts
      `;

      const result = await this.rawQuery(sql);
      return result[0] || {
        total: 0,
        connected: 0,
        disconnected: 0,
        connecting: 0,
        error: 0
      };
    } catch (error) {
      logger.error('获取主机统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近连接的主机
   */
  async getRecentlyConnected(limit = 10) {
    try {
      return await this.findAll({
        where: { status: 'connected' },
        orderBy: 'last_connected_at DESC',
        limit
      });
    } catch (error) {
      logger.error('获取最近连接主机失败:', error);
      throw error;
    }
  }
}

module.exports = {
  HostGroup,
  Host
};