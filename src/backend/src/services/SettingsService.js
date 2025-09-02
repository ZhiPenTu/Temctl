const database = require('../utils/database');
const logger = require('../utils/logger');
const cryptoUtils = require('../utils/crypto');

/**
 * 设置管理服务
 * 管理系统配置、用户首选项等
 */
class SettingsService {
  constructor() {
    // 设置分类定义
    this.categories = {
      general: '通用设置',
      terminal: '终端设置',
      security: '安全设置',
      ai: 'AI设置',
      file_transfer: '文件传输设置',
      ui: '界面设置',
      system: '系统设置'
    };
    
    // 默认设置
    this.defaultSettings = {
      // 通用设置
      'general.language': 'zh-CN',
      'general.theme': 'auto',
      'general.auto_save': 'true',
      'general.check_updates': 'true',
      'general.notification_enabled': 'true',
      
      // 终端设置
      'terminal.font_size': '14',
      'terminal.font_family': 'Monaco, Consolas, monospace',
      'terminal.theme': 'dark',
      'terminal.scrollback': '1000',
      'terminal.cursor_blink': 'true',
      'terminal.bell_sound': 'false',
      
      // 安全设置
      'security.enable_audit': 'true',
      'security.command_confirm': 'true',
      'security.session_timeout': '30',
      'security.auto_lock': 'false',
      'security.audit_log_retention': '90',
      'security.enable_2fa': 'false',
      
      // AI设置
      'ai.provider': 'openai',
      'ai.api_key': '',
      'ai.model': 'gpt-3.5-turbo',
      'ai.endpoint': '',
      'ai.temperature': '0.7',
      'ai.max_tokens': '1000',
      'ai.enable_context': 'true',
      
      // 文件传输设置
      'file_transfer.chunk_size': '65536',
      'file_transfer.max_concurrent': '5',
      'file_transfer.auto_retry': 'true',
      'file_transfer.retry_count': '3',
      'file_transfer.verify_checksum': 'true',
      
      // 界面设置
      'ui.sidebar_width': '240',
      'ui.show_toolbar': 'true',
      'ui.show_status_bar': 'true',
      'ui.window_state': 'maximized',
      'ui.animation_enabled': 'true',
      
      // 系统设置
      'system.log_level': 'info',
      'system.max_log_size': '100',
      'system.backup_enabled': 'true',
      'system.backup_interval': '24',
      'system.cleanup_enabled': 'true'
    };
  }

  /**
   * 初始化系统设置
   */
  async initialize() {
    try {
      logger.info('初始化系统设置...');
      
      // 检查是否已经初始化
      const existingSettings = await database.get(
        'SELECT COUNT(*) as count FROM system_settings'
      );
      
      if (existingSettings.count > 0) {
        logger.info('系统设置已存在，跳过初始化');
        return;
      }
      
      // 插入默认设置
      for (const [key, value] of Object.entries(this.defaultSettings)) {
        const [category, settingKey] = key.split('.');
        
        await database.run(
          'INSERT INTO system_settings (category, key, value, type, description) VALUES (?, ?, ?, ?, ?)',
          [
            category,
            settingKey,
            value,
            this.getSettingType(value),
            this.getSettingDescription(key)
          ]
        );
      }
      
      logger.info('系统设置初始化完成');
      
    } catch (error) {
      logger.error('初始化系统设置失败:', error);
      throw error;
    }
  }

  /**
   * 获取设置值
   */
  async getSetting(category, key) {
    try {
      const setting = await database.get(
        'SELECT * FROM system_settings WHERE category = ? AND key = ?',
        [category, key]
      );
      
      if (!setting) {
        return null;
      }
      
      // 解密敏感设置
      if (setting.encrypted && setting.value) {
        try {
          setting.value = await cryptoUtils.decryptCredential(setting.value);
        } catch (error) {
          logger.error('解密设置失败:', error);
          return null;
        }
      }
      
      return this.parseSettingValue(setting.value, setting.type);
      
    } catch (error) {
      logger.error('获取设置失败:', error);
      throw error;
    }
  }

  /**
   * 设置值
   */
  async setSetting(category, key, value, encrypted = false) {
    try {
      // 验证设置值
      this.validateSetting(category, key, value);
      
      let processedValue = value;
      
      // 加密敏感设置
      if (encrypted && value) {
        processedValue = await cryptoUtils.encryptCredential(String(value));
      }
      
      // 检查设置是否存在
      const existingSetting = await database.get(
        'SELECT id FROM system_settings WHERE category = ? AND key = ?',
        [category, key]
      );
      
      if (existingSetting) {
        // 更新现有设置
        await database.run(
          'UPDATE system_settings SET value = ?, encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ? AND key = ?',
          [processedValue, encrypted, category, key]
        );
      } else {
        // 创建新设置
        await database.run(
          'INSERT INTO system_settings (category, key, value, type, encrypted, description) VALUES (?, ?, ?, ?, ?, ?)',
          [
            category,
            key,
            processedValue,
            this.getSettingType(value),
            encrypted,
            this.getSettingDescription(`${category}.${key}`)
          ]
        );
      }
      
      logger.info('设置更新成功:', { category, key });
      
    } catch (error) {
      logger.error('设置值失败:', error);
      throw error;
    }
  }

  /**
   * 批量获取设置
   */
  async getSettings(category = null) {
    try {
      let query = 'SELECT * FROM system_settings';
      const params = [];
      
      if (category) {
        query += ' WHERE category = ?';
        params.push(category);
      }
      
      query += ' ORDER BY category, key';
      
      const settings = await database.query(query, params);
      
      // 组织设置数据
      const result = {};
      
      for (const setting of settings) {
        if (!result[setting.category]) {
          result[setting.category] = {};
        }
        
        let value = setting.value;
        
        // 解密敏感设置
        if (setting.encrypted && value) {
          try {
            value = await cryptoUtils.decryptCredential(value);
          } catch (error) {
            logger.error('解密设置失败:', error);
            value = null;
          }
        }
        
        result[setting.category][setting.key] = {
          value: this.parseSettingValue(value, setting.type),
          type: setting.type,
          encrypted: setting.encrypted,
          description: setting.description,
          updatedAt: setting.updated_at
        };
      }
      
      return result;
      
    } catch (error) {
      logger.error('获取设置列表失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新设置
   */
  async updateSettings(settingsData) {
    try {
      const results = {
        updated: 0,
        failed: 0,
        errors: []
      };
      
      for (const [category, categorySettings] of Object.entries(settingsData)) {
        for (const [key, settingData] of Object.entries(categorySettings)) {
          try {
            const { value, encrypted = false } = settingData;
            await this.setSetting(category, key, value, encrypted);
            results.updated++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              category,
              key,
              error: error.message
            });
          }
        }
      }
      
      logger.info('批量更新设置完成:', results);
      
      return results;
      
    } catch (error) {
      logger.error('批量更新设置失败:', error);
      throw error;
    }
  }

  /**
   * 删除设置
   */
  async deleteSetting(category, key) {
    try {
      const result = await database.run(
        'DELETE FROM system_settings WHERE category = ? AND key = ?',
        [category, key]
      );
      
      if (result.changes === 0) {
        throw new Error('设置不存在');
      }
      
      logger.info('设置删除成功:', { category, key });
      
    } catch (error) {
      logger.error('删除设置失败:', error);
      throw error;
    }
  }

  /**
   * 重置设置到默认值
   */
  async resetSettings(category = null) {
    try {
      let defaultsToReset = this.defaultSettings;
      
      if (category) {
        defaultsToReset = Object.fromEntries(
          Object.entries(this.defaultSettings).filter(([key]) => key.startsWith(`${category}.`))
        );
      }
      
      const results = {
        reset: 0,
        failed: 0,
        errors: []
      };
      
      for (const [key, value] of Object.entries(defaultsToReset)) {
        try {
          const [cat, settingKey] = key.split('.');
          await this.setSetting(cat, settingKey, value);
          results.reset++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            key,
            error: error.message
          });
        }
      }
      
      logger.info('重置设置完成:', results);
      
      return results;
      
    } catch (error) {
      logger.error('重置设置失败:', error);
      throw error;
    }
  }

  /**
   * 导出设置
   */
  async exportSettings(categories = null) {
    try {
      let settings;
      
      if (categories && Array.isArray(categories)) {
        settings = {};
        for (const category of categories) {
          const categorySettings = await this.getSettings(category);
          if (categorySettings[category]) {
            settings[category] = categorySettings[category];
          }
        }
      } else {
        settings = await this.getSettings();
      }
      
      // 移除敏感信息
      const safeSettings = this.sanitizeSettings(settings);
      
      return {
        version: '1.0',
        exportTime: new Date().toISOString(),
        settings: safeSettings
      };
      
    } catch (error) {
      logger.error('导出设置失败:', error);
      throw error;
    }
  }

  /**
   * 导入设置
   */
  async importSettings(importData, overwrite = false) {
    try {
      const { settings } = importData;
      
      if (!settings || typeof settings !== 'object') {
        throw new Error('无效的设置数据');
      }
      
      const results = {
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };
      
      for (const [category, categorySettings] of Object.entries(settings)) {
        for (const [key, settingData] of Object.entries(categorySettings)) {
          try {
            // 检查设置是否已存在
            if (!overwrite) {
              const existing = await this.getSetting(category, key);
              if (existing !== null) {
                results.skipped++;
                continue;
              }
            }
            
            await this.setSetting(category, key, settingData.value, settingData.encrypted);
            results.imported++;
            
          } catch (error) {
            results.failed++;
            results.errors.push({
              category,
              key,
              error: error.message
            });
          }
        }
      }
      
      logger.info('导入设置完成:', results);
      
      return results;
      
    } catch (error) {
      logger.error('导入设置失败:', error);
      throw error;
    }
  }

  /**
   * 获取设置统计
   */
  async getSettingsStats() {
    try {
      const stats = {};
      
      // 按分类统计
      const categoryStats = await database.query(`
        SELECT category, 
               COUNT(*) as total,
               SUM(CASE WHEN encrypted = true THEN 1 ELSE 0 END) as encrypted_count
        FROM system_settings 
        GROUP BY category
      `);
      
      stats.byCategory = categoryStats;
      
      // 总体统计
      const totalStats = await database.get(`
        SELECT COUNT(*) as total,
               COUNT(DISTINCT category) as categories,
               SUM(CASE WHEN encrypted = true THEN 1 ELSE 0 END) as encrypted_total,
               MAX(updated_at) as last_updated
        FROM system_settings
      `);
      
      stats.summary = totalStats;
      
      return stats;
      
    } catch (error) {
      logger.error('获取设置统计失败:', error);
      throw error;
    }
  }

  /**
   * 验证设置值
   */
  validateSetting(category, key, value) {
    const fullKey = `${category}.${key}`;
    
    // 数值类型验证
    if (['terminal.font_size', 'terminal.scrollback', 'security.session_timeout'].includes(fullKey)) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        throw new Error(`${fullKey} 必须是非负数字`);
      }
    }
    
    // 布尔类型验证
    const booleanSettings = [
      'general.auto_save', 'general.check_updates', 'security.enable_audit',
      'security.command_confirm', 'ai.enable_context', 'file_transfer.auto_retry'
    ];
    
    if (booleanSettings.includes(fullKey)) {
      if (!['true', 'false', true, false].includes(value)) {
        throw new Error(`${fullKey} 必须是布尔值`);
      }
    }
    
    // 枚举值验证
    const enumValidations = {
      'general.language': ['zh-CN', 'en-US'],
      'general.theme': ['auto', 'light', 'dark'],
      'terminal.theme': ['light', 'dark', 'high-contrast'],
      'ai.provider': ['openai', 'local', 'claude', 'gemini'],
      'system.log_level': ['debug', 'info', 'warn', 'error']
    };
    
    if (enumValidations[fullKey] && !enumValidations[fullKey].includes(value)) {
      throw new Error(`${fullKey} 的值必须是: ${enumValidations[fullKey].join(', ')} 之一`);
    }
  }

  /**
   * 解析设置值
   */
  parseSettingValue(value, type) {
    if (value === null || value === undefined) {
      return value;
    }
    
    switch (type) {
      case 'boolean':
        return value === 'true' || value === true;
      case 'number':
        return Number(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return String(value);
    }
  }

  /**
   * 获取设置类型
   */
  getSettingType(value) {
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      return 'boolean';
    }
    
    if (!isNaN(Number(value))) {
      return 'number';
    }
    
    if (typeof value === 'object') {
      return 'json';
    }
    
    return 'string';
  }

  /**
   * 获取设置描述
   */
  getSettingDescription(key) {
    const descriptions = {
      'general.language': '界面语言',
      'general.theme': '界面主题',
      'general.auto_save': '自动保存',
      'general.check_updates': '检查更新',
      'terminal.font_size': '终端字体大小',
      'terminal.font_family': '终端字体',
      'terminal.theme': '终端主题',
      'terminal.scrollback': '终端缓冲行数',
      'security.enable_audit': '启用审计日志',
      'security.command_confirm': '命令确认',
      'security.session_timeout': '会话超时时间(分钟)',
      'ai.provider': 'AI服务提供商',
      'ai.api_key': 'AI API密钥',
      'ai.model': 'AI模型',
      'ai.endpoint': 'AI服务端点',
      'file_transfer.chunk_size': '传输块大小',
      'file_transfer.max_concurrent': '最大并发传输数',
      'system.log_level': '日志级别'
    };
    
    return descriptions[key] || '';
  }

  /**
   * 清理敏感设置信息
   */
  sanitizeSettings(settings) {
    const safeSettings = JSON.parse(JSON.stringify(settings));
    
    // 移除敏感字段的值
    const sensitiveKeys = ['api_key', 'password', 'token', 'secret'];
    
    for (const [category, categorySettings] of Object.entries(safeSettings)) {
      for (const [key, setting] of Object.entries(categorySettings)) {
        if (setting.encrypted || sensitiveKeys.some(sensitive => key.includes(sensitive))) {
          setting.value = '***';
        }
      }
    }
    
    return safeSettings;
  }
}

module.exports = new SettingsService();