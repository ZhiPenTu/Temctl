// 测试环境设置

// 设置测试超时
jest.setTimeout(30000);

// 全局测试变量
global.testConfig = {
  database: {
    filename: ':memory:', // 内存数据库用于测试
    timeout: 5000
  },
  server: {
    port: 0, // 随机端口
    host: 'localhost'
  },
  ssh: {
    testHost: 'localhost',
    testPort: 22,
    testUser: 'testuser',
    testPassword: 'testpass'
  }
};

// 模拟外部依赖
global.mockModules = {
  ssh2: {
    Client: class MockSSHClient {
      connect() { this.emit('ready'); }
      end() { this.emit('close'); }
      destroy() { this.emit('close'); }
      exec() { /* mock implementation */ }
      sftp() { /* mock implementation */ }
      on() { /* mock event listener */ }
      emit() { /* mock event emitter */ }
    }
  },
  fs: {
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
  }
};

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
});

// 测试后清理
afterAll(async () => {
  // 清理测试数据和资源
});

console.log('测试环境已初始化');