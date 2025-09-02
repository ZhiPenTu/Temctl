// 应用性能监控器 - 收集和分析性能指标

class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.sampleInterval = options.sampleInterval || 5000; // 5秒采样间隔
    this.historyLimit = options.historyLimit || 1440; // 保存24小时数据（每5秒一个点）
    
    this.metrics = {
      system: {
        cpu: [],
        memory: [],
        diskIO: [],
        networkIO: []
      },
      application: {
        requests: [],
        responses: [],
        errors: [],
        connections: []
      },
      database: {
        queries: [],
        transactions: []
      }
    };
    
    this.counters = {
      totalRequests: 0,
      totalErrors: 0,
      activeConnections: 0
    };
    
    this.timers = new Map(); // 用于跟踪操作耗时
    
    if (this.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    // 系统指标监控
    this.systemMonitorInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.sampleInterval);

    console.log('性能监控已启动');
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
      this.systemMonitorInterval = null;
    }
    console.log('性能监控已停止');
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    const timestamp = Date.now();
    
    // CPU使用率
    this.collectCPUUsage(timestamp);
    
    // 内存使用率
    this.collectMemoryUsage(timestamp);
    
    // 进程信息
    this.collectProcessMetrics(timestamp);
  }

  /**
   * 收集CPU使用率
   */
  collectCPUUsage(timestamp) {
    const os = require('os');
    const cpus = os.cpus();
    
    // 计算CPU使用率
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - (totalIdle / totalTick * 100);
    
    this.addMetric('system.cpu', {
      timestamp,
      usage: cpuUsage,
      cores: cpus.length
    });
  }

  /**
   * 收集内存使用率
   */
  collectMemoryUsage(timestamp) {
    const os = require('os');
    const process = require('process');
    
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    
    // 进程内存使用
    const processMemory = process.memoryUsage();
    
    this.addMetric('system.memory', {
      timestamp,
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usage: memoryUsage,
      process: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external
      }
    });
  }

  /**
   * 收集进程指标
   */
  collectProcessMetrics(timestamp) {
    const process = require('process');
    
    this.addMetric('application.process', {
      timestamp,
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    });
  }

  /**
   * 开始计时
   */
  startTimer(name) {
    this.timers.set(name, {
      startTime: Date.now(),
      startHrTime: process.hrtime()
    });
  }

  /**
   * 结束计时并记录
   */
  endTimer(name) {
    const timer = this.timers.get(name);
    if (!timer) {
      console.warn(`计时器 ${name} 不存在`);
      return null;
    }

    const endTime = Date.now();
    const [seconds, nanoseconds] = process.hrtime(timer.startHrTime);
    const duration = seconds * 1000 + nanoseconds / 1000000; // 毫秒

    this.timers.delete(name);

    // 记录响应时间指标
    this.addMetric('application.responses', {
      timestamp: endTime,
      operation: name,
      duration,
      startTime: timer.startTime,
      endTime
    });

    return duration;
  }

  /**
   * 记录请求指标
   */
  recordRequest(requestInfo) {
    this.counters.totalRequests++;
    
    this.addMetric('application.requests', {
      timestamp: Date.now(),
      method: requestInfo.method,
      url: requestInfo.url,
      userAgent: requestInfo.userAgent,
      ip: requestInfo.ip,
      ...requestInfo
    });
  }

  /**
   * 记录错误指标
   */
  recordError(errorInfo) {
    this.counters.totalErrors++;
    
    this.addMetric('application.errors', {
      timestamp: Date.now(),
      message: errorInfo.message,
      stack: errorInfo.stack,
      code: errorInfo.code,
      ...errorInfo
    });
  }

  /**
   * 记录连接指标
   */
  recordConnection(action, connectionInfo = {}) {
    if (action === 'connect') {
      this.counters.activeConnections++;
    } else if (action === 'disconnect') {
      this.counters.activeConnections = Math.max(0, this.counters.activeConnections - 1);
    }
    
    this.addMetric('application.connections', {
      timestamp: Date.now(),
      action,
      activeCount: this.counters.activeConnections,
      ...connectionInfo
    });
  }

  /**
   * 记录数据库查询
   */
  recordDatabaseQuery(queryInfo) {
    this.addMetric('database.queries', {
      timestamp: Date.now(),
      sql: queryInfo.sql,
      duration: queryInfo.duration,
      rowCount: queryInfo.rowCount,
      ...queryInfo
    });
  }

  /**
   * 添加指标数据
   */
  addMetric(metricPath, data) {
    if (!this.enabled) return;

    const pathParts = metricPath.split('.');
    let current = this.metrics;
    
    // 导航到指标路径
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }
    
    const finalKey = pathParts[pathParts.length - 1];
    if (!current[finalKey]) {
      current[finalKey] = [];
    }
    
    // 添加数据点
    current[finalKey].push(data);
    
    // 限制历史数据长度
    if (current[finalKey].length > this.historyLimit) {
      current[finalKey] = current[finalKey].slice(-this.historyLimit);
    }
  }

  /**
   * 获取指标数据
   */
  getMetrics(metricPath, options = {}) {
    const { 
      limit = 100, 
      since = 0, 
      aggregation = null 
    } = options;
    
    const pathParts = metricPath.split('.');
    let current = this.metrics;
    
    // 导航到指标路径
    for (const part of pathParts) {
      if (!current[part]) {
        return [];
      }
      current = current[part];
    }
    
    // 过滤数据
    let data = Array.isArray(current) ? current : [];
    
    if (since > 0) {
      data = data.filter(item => item.timestamp >= since);
    }
    
    // 限制数量
    if (limit > 0) {
      data = data.slice(-limit);
    }
    
    // 聚合数据
    if (aggregation) {
      data = this.aggregateData(data, aggregation);
    }
    
    return data;
  }

  /**
   * 数据聚合
   */
  aggregateData(data, aggregation) {
    if (!data.length) return [];
    
    const { 
      interval = 60000, // 1分钟聚合间隔
      functions = ['avg', 'min', 'max', 'count']
    } = aggregation;
    
    // 按时间间隔分组
    const groups = {};
    data.forEach(item => {
      const bucket = Math.floor(item.timestamp / interval) * interval;
      if (!groups[bucket]) {
        groups[bucket] = [];
      }
      groups[bucket].push(item);
    });
    
    // 计算聚合值
    return Object.keys(groups).map(timestamp => {
      const group = groups[timestamp];
      const result = { timestamp: parseInt(timestamp) };
      
      functions.forEach(func => {
        switch (func) {
          case 'avg':
            result.avg = this.calculateAverage(group);
            break;
          case 'min':
            result.min = this.calculateMin(group);
            break;
          case 'max':
            result.max = this.calculateMax(group);
            break;
          case 'count':
            result.count = group.length;
            break;
          case 'sum':
            result.sum = this.calculateSum(group);
            break;
        }
      });
      
      return result;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 计算平均值
   */
  calculateAverage(data) {
    if (!data.length) return 0;
    
    const sum = data.reduce((acc, item) => {
      return acc + (item.value || item.duration || item.usage || 0);
    }, 0);
    
    return sum / data.length;
  }

  /**
   * 计算最小值
   */
  calculateMin(data) {
    if (!data.length) return 0;
    
    return Math.min(...data.map(item => 
      item.value || item.duration || item.usage || 0
    ));
  }

  /**
   * 计算最大值
   */
  calculateMax(data) {
    if (!data.length) return 0;
    
    return Math.max(...data.map(item => 
      item.value || item.duration || item.usage || 0
    ));
  }

  /**
   * 计算总和
   */
  calculateSum(data) {
    return data.reduce((acc, item) => {
      return acc + (item.value || item.duration || item.usage || 0);
    }, 0);
  }

  /**
   * 获取性能摘要
   */
  getSummary() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    return {
      timestamp: now,
      counters: { ...this.counters },
      system: {
        cpu: this.getLatestMetric('system.cpu'),
        memory: this.getLatestMetric('system.memory')
      },
      performance: {
        avgResponseTime: this.getAverageResponseTime(oneHourAgo),
        errorRate: this.getErrorRate(oneHourAgo),
        throughput: this.getThroughput(oneHourAgo)
      }
    };
  }

  /**
   * 获取最新指标
   */
  getLatestMetric(metricPath) {
    const data = this.getMetrics(metricPath, { limit: 1 });
    return data.length > 0 ? data[0] : null;
  }

  /**
   * 计算平均响应时间
   */
  getAverageResponseTime(since) {
    const responses = this.getMetrics('application.responses', { since });
    if (!responses.length) return 0;
    
    const totalTime = responses.reduce((sum, response) => sum + response.duration, 0);
    return totalTime / responses.length;
  }

  /**
   * 计算错误率
   */
  getErrorRate(since) {
    const errors = this.getMetrics('application.errors', { since });
    const requests = this.getMetrics('application.requests', { since });
    
    if (!requests.length) return 0;
    return (errors.length / requests.length) * 100;
  }

  /**
   * 计算吞吐量
   */
  getThroughput(since) {
    const requests = this.getMetrics('application.requests', { since });
    const timespan = (Date.now() - since) / 1000; // 秒
    
    return requests.length / timespan;
  }

  /**
   * 清理历史数据
   */
  cleanup(olderThan = 86400000) { // 默认清理24小时前的数据
    const cutoff = Date.now() - olderThan;
    
    const cleanupMetrics = (obj) => {
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          obj[key] = obj[key].filter(item => item.timestamp > cutoff);
        } else if (typeof obj[key] === 'object') {
          cleanupMetrics(obj[key]);
        }
      }
    };
    
    cleanupMetrics(this.metrics);
  }
}

module.exports = PerformanceMonitor;