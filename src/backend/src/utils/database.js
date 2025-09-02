const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.db = null;
    this.isConnected = false;
  }

  /**
   * 初始化数据库连接
   */
  async init() {
    try {
      // 确保数据库目录存在
      const dbPath = config.database.sqlite.path;
      const dbDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.database('创建数据库目录:', dbDir);
      }

      // 创建数据库连接
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('数据库连接失败:', err);
          throw err;
        }
        logger.database('数据库连接成功:', dbPath);
      });

      // 设置数据库配置
      await this.configure();
      
      // 初始化数据库表
      await this.initTables();
      
      this.isConnected = true;
      logger.database('数据库初始化完成');
    } catch (error) {
      logger.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 配置数据库
   */
  async configure() {
    return new Promise((resolve, reject) => {
      // 启用外键约束
      this.db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 设置WAL模式提高并发性能
        this.db.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // 设置同步模式
          this.db.run('PRAGMA synchronous = NORMAL', (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            // 设置缓存大小
            this.db.run('PRAGMA cache_size = -64000', (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              logger.database('数据库配置完成');
              resolve();
            });
          });
        });
      });
    });
  }

  /**
   * 初始化数据库表
   */
  async initTables() {
    try {
      const initSqlPath = path.join(__dirname, '../data/init.sql');
      
      if (!fs.existsSync(initSqlPath)) {
        throw new Error('初始化SQL文件不存在');
      }

      const initSql = fs.readFileSync(initSqlPath, 'utf8');
      
      return new Promise((resolve, reject) => {
        this.db.exec(initSql, (err) => {
          if (err) {
            logger.error('执行初始化SQL失败:', err);
            reject(err);
            return;
          }
          
          logger.database('数据库表初始化完成');
          resolve();
        });
      });
    } catch (error) {
      logger.error('读取初始化SQL文件失败:', error);
      throw error;
    }
  }

  /**
   * 执行SQL查询
   */
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('SQL查询失败:', { sql, params, error: err });
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * 执行SQL查询并返回单行
   */
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('SQL查询失败:', { sql, params, error: err });
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * 执行SQL插入/更新/删除
   */
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('SQL执行失败:', { sql, params, error: err });
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          changes: this.changes
        });
      });
    });
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        Promise.resolve(callback(this))
          .then(result => {
            this.db.run('COMMIT', (err) => {
              if (err) {
                logger.error('事务提交失败:', err);
                reject(err);
                return;
              }
              resolve(result);
            });
          })
          .catch(error => {
            this.db.run('ROLLBACK', (rollbackErr) => {
              if (rollbackErr) {
                logger.error('事务回滚失败:', rollbackErr);
              }
              logger.error('事务执行失败:', error);
              reject(error);
            });
          });
      });
    });
  }

  /**
   * 获取表信息
   */
  async getTableInfo(tableName) {
    return this.query(`PRAGMA table_info(${tableName})`);
  }

  /**
   * 检查表是否存在
   */
  async tableExists(tableName) {
    const result = await this.get(
      'SELECT name FROM sqlite_master WHERE type="table" AND name=?',
      [tableName]
    );
    return !!result;
  }

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    try {
      const tables = await this.query(
        'SELECT name FROM sqlite_master WHERE type="table" ORDER BY name'
      );
      
      const stats = {
        tables: [],
        totalRecords: 0
      };
      
      for (const table of tables) {
        const countResult = await this.get(`SELECT COUNT(*) as count FROM ${table.name}`);
        const tableInfo = {
          name: table.name,
          records: countResult.count
        };
        
        stats.tables.push(tableInfo);
        stats.totalRecords += countResult.count;
      }
      
      return stats;
    } catch (error) {
      logger.error('获取数据库统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 备份数据库
   */
  async backup(backupPath) {
    return new Promise((resolve, reject) => {
      const backup = this.db.backup(backupPath);
      
      backup.step(-1, (err) => {
        if (err) {
          logger.error('数据库备份失败:', err);
          reject(err);
          return;
        }
        
        backup.finish((finishErr) => {
          if (finishErr) {
            logger.error('数据库备份完成失败:', finishErr);
            reject(finishErr);
            return;
          }
          
          logger.database('数据库备份完成:', backupPath);
          resolve();
        });
      });
    });
  }

  /**
   * 清理数据库 (删除过期数据)
   */
  async cleanup() {
    try {
      const retentionDays = await this.get(
        'SELECT value FROM system_settings WHERE category = "security" AND key = "audit_log_retention"'
      );
      
      const days = retentionDays ? parseInt(retentionDays.value) : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // 清理过期的审计日志
      const result = await this.run(
        'DELETE FROM audit_logs WHERE created_at < ?',
        [cutoffDate.toISOString()]
      );
      
      logger.database('清理过期审计日志:', result.changes);
      
      // 清理过期的文件传输记录
      const transferResult = await this.run(
        'DELETE FROM file_transfers WHERE status IN ("completed", "failed") AND created_at < ?',
        [cutoffDate.toISOString()]
      );
      
      logger.database('清理过期文件传输记录:', transferResult.changes);
      
      // 执行VACUUM优化数据库
      await this.run('VACUUM');
      logger.database('数据库优化完成');
      
      return {
        auditLogsDeleted: result.changes,
        transfersDeleted: transferResult.changes
      };
    } catch (error) {
      logger.error('数据库清理失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.db && this.isConnected) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            logger.error('关闭数据库连接失败:', err);
          } else {
            logger.database('数据库连接已关闭');
          }
          this.isConnected = false;
          resolve();
        });
      });
    }
  }

  /**
   * 检查数据库连接状态
   */
  isReady() {
    return this.isConnected && this.db;
  }
}

// 创建数据库实例
const database = new Database();

module.exports = database;
