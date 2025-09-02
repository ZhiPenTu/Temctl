// 应用缓存管理器 - 提供高效的数据缓存

class CacheManager {
  constructor(options = {}) {
    this.defaultTTL = options.defaultTTL || 300000; // 5分钟默认TTL
    this.maxSize = options.maxSize || 1000; // 最大缓存条目数
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };

    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 设置缓存
   */
  set(key, value, ttl = this.defaultTTL) {
    // 检查缓存大小限制
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // 清除现有的过期定时器
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置缓存项
    const cacheItem = {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 0
    };

    this.cache.set(key, cacheItem);
    this.stats.sets++;

    // 设置过期定时器
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }

    return true;
  }

  /**
   * 获取缓存
   */
  get(key) {
    const cacheItem = this.cache.get(key);

    if (!cacheItem) {
      this.stats.misses++;
      return undefined;
    }

    // 检查是否过期
    if (this.isExpired(cacheItem)) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // 更新访问统计
    cacheItem.accessCount++;
    this.stats.hits++;

    return cacheItem.value;
  }

  /**
   * 删除缓存
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    
    // 清除定时器
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    if (deleted) {
      this.stats.deletes++;
    }

    return deleted;
  }

  /**
   * 检查缓存是否存在
   */
  has(key) {
    const cacheItem = this.cache.get(key);
    if (!cacheItem) return false;

    if (this.isExpired(cacheItem)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清空所有缓存
   */
  clear() {
    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.cache.clear();
    this.timers.clear();
    
    // 重置统计
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * 获取或设置缓存（如果不存在）
   */
  async getOrSet(key, factory, ttl = this.defaultTTL) {
    let value = this.get(key);
    
    if (value === undefined) {
      // 缓存未命中，通过factory函数获取值
      if (typeof factory === 'function') {
        value = await factory();
      } else {
        value = factory;
      }
      
      this.set(key, value, ttl);
    }
    
    return value;
  }

  /**
   * 批量获取
   */
  mget(keys) {
    const result = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 批量设置
   */
  mset(keyValuePairs, ttl = this.defaultTTL) {
    const results = {};
    for (const [key, value] of Object.entries(keyValuePairs)) {
      results[key] = this.set(key, value, ttl);
    }
    return results;
  }

  /**
   * 增量操作
   */
  increment(key, delta = 1, initialValue = 0, ttl = this.defaultTTL) {
    const currentValue = this.get(key);
    const newValue = (currentValue !== undefined ? currentValue : initialValue) + delta;
    this.set(key, newValue, ttl);
    return newValue;
  }

  /**
   * 检查缓存项是否过期
   */
  isExpired(cacheItem) {
    if (cacheItem.ttl <= 0) return false; // 永不过期
    return Date.now() - cacheItem.timestamp > cacheItem.ttl;
  }

  /**
   * LRU淘汰策略
   */
  evictLRU() {
    let lruKey = null;
    let lruTimestamp = Date.now();
    let lruAccessCount = Infinity;

    // 找到最少访问且最久未使用的缓存项
    for (const [key, cacheItem] of this.cache) {
      if (cacheItem.accessCount < lruAccessCount || 
          (cacheItem.accessCount === lruAccessCount && cacheItem.timestamp < lruTimestamp)) {
        lruKey = key;
        lruTimestamp = cacheItem.timestamp;
        lruAccessCount = cacheItem.accessCount;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const expiredKeys = [];
    
    for (const [key, cacheItem] of this.cache) {
      if (this.isExpired(cacheItem)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期缓存项`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * 估算内存使用量
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, cacheItem] of this.cache) {
      // 粗略估算键和值的内存占用
      totalSize += this.estimateSize(key) + this.estimateSize(cacheItem.value);
    }
    
    return totalSize;
  }

  /**
   * 估算对象大小
   */
  estimateSize(obj) {
    if (obj === null || obj === undefined) return 0;
    
    switch (typeof obj) {
      case 'string':
        return obj.length * 2; // Unicode字符
      case 'number':
        return 8;
      case 'boolean':
        return 4;
      case 'object':
        if (Buffer.isBuffer(obj)) {
          return obj.length;
        }
        return JSON.stringify(obj).length * 2;
      default:
        return 0;
    }
  }

  /**
   * 获取缓存键列表
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存大小
   */
  size() {
    return this.cache.size;
  }
}

module.exports = CacheManager;