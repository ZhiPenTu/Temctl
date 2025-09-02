const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * 系统设置模型
 */
class SystemSettings extends BaseModel {
  constructor() {
    super('system_settings');
  }

  /**
   * 获取设置值
   */
  async getValue(category, key, defaultValue = null) {
    try {
      const setting = await this.findOne({ category, key });
      
      if (!setting) {
        return defaultValue;
      }

      // 根据类型转换值
      switch (setting.type) {
        case 'number':
          return Number(setting.value);
        case 'boolean':
          return setting.value === 'true';
        case 'json':
          return JSON.parse(setting.value);
        default:
          return setting.value;
      }
    } catch (error) {
      logger.error('获取设置值失败:', error);
      return defaultValue;
    }
  }

  /**
   * 设置值
   */
  async setValue(category, key, value, type = 'string', description = '') {
    try {
      // 转换值为字符串
      let stringValue;
      switch (type) {
        case 'number':
          stringValue = String(Number(value));
          break;
        case 'boolean':
          stringValue = String(Boolean(value));
          break;
        case 'json':
          stringValue = JSON.stringify(value);
          break;
        default:
          stringValue = String(value);
      }

      // 检查设置是否存在
      const existingSetting = await this.findOne({ category, key });
      
      if (existingSetting) {
        // 更新现有设置
        return await this.update(existingSetting.id, {
          value: stringValue,
          type,
          description
        });
      } else {
        // 创建新设置
        return await this.create({
          category,
          key,
          value: stringValue,
          type,
          description
        });
      }
    } catch (error) {
      logger.error('设置值失败:', error);
      throw error;
    }
  }

  /**
   * 获取分类下的所有设置
   */
  async getCategorySettings(category) {
    try {
      const settings = await this.findAll({
        where: { category },
        orderBy: 'key'
      });

      // 转换为对象格式
      const result = {};
      settings.forEach(setting => {
        let value = setting.value;
        
        // 根据类型转换值
        switch (setting.type) {
          case 'number':
            value = Number(value);
            break;
          case 'boolean':
            value = value === 'true';
            break;
          case 'json':
            value = JSON.parse(value);
            break;
        }
        
        result[setting.key] = {
          value,
          type: setting.type,
          description: setting.description
        };
      });

      return result;
    } catch (error) {
      logger.error('获取分类设置失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新设置
   */
  async updateSettings(category, settings) {
    try {
      const results = [];
      
      for (const [key, config] of Object.entries(settings)) {
        const result = await this.setValue(
          category,
          key,
          config.value,
          config.type || 'string',
          config.description || ''
        );
        results.push(result);
      }
      
      return results;
    } catch (error) {
      logger.error('批量更新设置失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有设置（按分类分组）
   */
  async getAllSettings() {
    try {
      const settings = await this.findAll({
        orderBy: 'category, key'
      });

      // 按分类分组
      const grouped = {};
      settings.forEach(setting => {
        if (!grouped[setting.category]) {
          grouped[setting.category] = {};
        }
        
        let value = setting.value;
        
        // 根据类型转换值
        switch (setting.type) {
          case 'number':
            value = Number(value);
            break;
          case 'boolean':
            value = value === 'true';
            break;
          case 'json':
            value = JSON.parse(value);
            break;
        }
        
        grouped[setting.category][setting.key] = {
          value,
          type: setting.type,
          description: setting.description
        };
      });

      return grouped;
    } catch (error) {
      logger.error('获取所有设置失败:', error);
      throw error;
    }
  }

  /**
   * 删除设置
   */
  async deleteSetting(category, key) {
    try {
      const setting = await this.findOne({ category, key });
      
      if (!setting) {
        throw new Error('设置不存在');
      }

      return await this.delete(setting.id);
    } catch (error) {
      logger.error('删除设置失败:', error);
      throw error;
    }
  }

  /**
   * 重置分类下的所有设置为默认值
   */
  async resetCategory(category) {
    try {
      return await this.deleteMany({ category });
    } catch (error) {
      logger.error('重置分类设置失败:', error);
      throw error;
    }
  }
}

/**
 * 用户模型
 */
class User extends BaseModel {
  constructor() {
    super('users');
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username) {
    try {
      return await this.findOne({ username });
    } catch (error) {
      logger.error('根据用户名查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email) {
    try {
      return await this.findOne({ email });
    } catch (error) {
      logger.error('根据邮箱查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(userId) {
    try {
      return await this.update(userId, {
        last_login_at: new Date().toISOString(),
        login_attempts: 0, // 重置登录尝试次数
        locked_until: null // 清除锁定状态
      });
    } catch (error) {
      logger.error('更新最后登录时间失败:', error);
      throw error;
    }
  }

  /**
   * 增加登录失败次数
   */
  async incrementLoginAttempts(userId, maxAttempts = 5, lockoutDuration = 15) {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const attempts = (user.login_attempts || 0) + 1;
      const updateData = {
        login_attempts: attempts
      };

      // 如果达到最大尝试次数，锁定账户
      if (attempts >= maxAttempts) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + lockoutDuration);
        updateData.locked_until = lockoutUntil.toISOString();
      }

      return await this.update(userId, updateData);
    } catch (error) {
      logger.error('增加登录失败次数失败:', error);
      throw error;
    }
  }

  /**
   * 检查账户是否被锁定
   */
  async isAccountLocked(userId) {
    try {
      const user = await this.findById(userId);
      if (!user || !user.locked_until) {
        return false;
      }

      const lockoutTime = new Date(user.locked_until);
      const now = new Date();

      if (now < lockoutTime) {
        return true; // 仍在锁定期内
      } else {
        // 锁定期已过，清除锁定状态
        await this.update(userId, {
          locked_until: null,
          login_attempts: 0
        });
        return false;
      }
    } catch (error) {
      logger.error('检查账户锁定状态失败:', error);
      throw error;
    }
  }

  /**
   * 更改用户状态
   */
  async changeStatus(userId, status) {
    try {
      const validStatuses = ['active', 'inactive', 'suspended'];
      if (!validStatuses.includes(status)) {
        throw new Error('无效的用户状态');
      }

      return await this.update(userId, { status });
    } catch (error) {
      logger.error('更改用户状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN locked_until > datetime('now') THEN 1 ELSE 0 END) as locked
        FROM ${this.tableName}
      `;

      const result = await this.rawQuery(sql);
      return result[0] || {
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        admins: 0,
        locked: 0
      };
    } catch (error) {
      logger.error('获取用户统计信息失败:', error);
      throw error;
    }
  }
}

module.exports = {
  SystemSettings,
  User
};