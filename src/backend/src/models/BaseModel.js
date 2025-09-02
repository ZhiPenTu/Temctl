const database = require('../utils/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * 基础模型类
 * 提供通用的数据库操作方法
 */
class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.primaryKey = 'id';
  }

  /**
   * 生成UUID
   */
  generateId() {
    return uuidv4();
  }

  /**
   * 创建记录
   */
  async create(data) {
    try {
      // 如果没有ID，自动生成
      if (!data[this.primaryKey]) {
        data[this.primaryKey] = this.generateId();
      }

      // 添加创建时间
      if (!data.created_at) {
        data.created_at = new Date().toISOString();
      }

      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map(() => '?').join(', ');

      const sql = `
        INSERT INTO ${this.tableName} (${fields.join(', ')})
        VALUES (${placeholders})
      `;

      const result = await database.run(sql, values);
      logger.database(`${this.tableName}记录创建成功:`, data[this.primaryKey]);

      return this.findById(data[this.primaryKey]);
    } catch (error) {
      logger.error(`创建${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 根据ID查找记录
   */
  async findById(id) {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const result = await database.get(sql, [id]);
      return result;
    } catch (error) {
      logger.error(`查找${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 查找所有记录
   */
  async findAll(options = {}) {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params = [];

      // 添加WHERE条件
      if (options.where) {
        const conditions = [];
        for (const [field, value] of Object.entries(options.where)) {
          conditions.push(`${field} = ?`);
          params.push(value);
        }
        if (conditions.length > 0) {
          sql += ` WHERE ${conditions.join(' AND ')}`;
        }
      }

      // 添加排序
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;
        if (options.order) {
          sql += ` ${options.order}`;
        }
      }

      // 添加分页
      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
        if (options.offset) {
          sql += ` OFFSET ${options.offset}`;
        }
      }

      const results = await database.query(sql, params);
      return results;
    } catch (error) {
      logger.error(`查询${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 查找单条记录
   */
  async findOne(where) {
    try {
      const conditions = [];
      const params = [];

      for (const [field, value] of Object.entries(where)) {
        conditions.push(`${field} = ?`);
        params.push(value);
      }

      const sql = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;
      const result = await database.get(sql, params);
      return result;
    } catch (error) {
      logger.error(`查找${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 更新记录
   */
  async update(id, data) {
    try {
      // 添加更新时间
      if (!data.updated_at) {
        data.updated_at = new Date().toISOString();
      }

      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map(field => `${field} = ?`).join(', ');

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;
      values.push(id);

      const result = await database.run(sql, values);
      
      if (result.changes === 0) {
        throw new Error(`${this.tableName}记录不存在或未更新`);
      }

      logger.database(`${this.tableName}记录更新成功:`, id);
      return this.findById(id);
    } catch (error) {
      logger.error(`更新${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 删除记录
   */
  async delete(id) {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const result = await database.run(sql, [id]);

      if (result.changes === 0) {
        throw new Error(`${this.tableName}记录不存在`);
      }

      logger.database(`${this.tableName}记录删除成功:`, id);
      return result.changes;
    } catch (error) {
      logger.error(`删除${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 批量删除记录
   */
  async deleteMany(where) {
    try {
      const conditions = [];
      const params = [];

      for (const [field, value] of Object.entries(where)) {
        conditions.push(`${field} = ?`);
        params.push(value);
      }

      const sql = `DELETE FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`;
      const result = await database.run(sql, params);

      logger.database(`${this.tableName}批量删除记录:`, result.changes);
      return result.changes;
    } catch (error) {
      logger.error(`批量删除${this.tableName}记录失败:`, error);
      throw error;
    }
  }

  /**
   * 统计记录数量
   */
  async count(where = {}) {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params = [];

      if (Object.keys(where).length > 0) {
        const conditions = [];
        for (const [field, value] of Object.entries(where)) {
          conditions.push(`${field} = ?`);
          params.push(value);
        }
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await database.get(sql, params);
      return result.count;
    } catch (error) {
      logger.error(`统计${this.tableName}记录数量失败:`, error);
      throw error;
    }
  }

  /**
   * 检查记录是否存在
   */
  async exists(id) {
    try {
      const result = await this.findById(id);
      return !!result;
    } catch (error) {
      logger.error(`检查${this.tableName}记录存在性失败:`, error);
      throw error;
    }
  }

  /**
   * 分页查询
   */
  async paginate(page = 1, pageSize = 10, options = {}) {
    try {
      const offset = (page - 1) * pageSize;
      const total = await this.count(options.where || {});
      
      const items = await this.findAll({
        ...options,
        limit: pageSize,
        offset: offset
      });

      return {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error(`分页查询${this.tableName}失败:`, error);
      throw error;
    }
  }

  /**
   * 执行原始SQL查询
   */
  async rawQuery(sql, params = []) {
    try {
      return await database.query(sql, params);
    } catch (error) {
      logger.error(`执行原始SQL查询失败:`, error);
      throw error;
    }
  }

  /**
   * 执行原始SQL
   */
  async rawRun(sql, params = []) {
    try {
      return await database.run(sql, params);
    } catch (error) {
      logger.error(`执行原始SQL失败:`, error);
      throw error;
    }
  }
}

module.exports = BaseModel;