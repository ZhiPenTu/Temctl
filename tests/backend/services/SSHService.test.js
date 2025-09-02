// SSH服务单元测试

const SSHService = require('../../src/backend/src/services/SSHService');

describe('SSHService', () => {
  let sshService;
  
  beforeEach(() => {
    sshService = new SSHService();
  });
  
  afterEach(async () => {
    await sshService.closeAll();
  });

  describe('连接管理', () => {
    test('应该能够创建SSH连接', async () => {
      const mockConfig = {
        id: 'test-host-1',
        hostname: 'localhost',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'testpass'
      };

      // 模拟SSH2客户端
      jest.doMock('ssh2', () => ({
        Client: jest.fn().mockImplementation(() => ({
          connect: jest.fn(),
          on: jest.fn((event, callback) => {
            if (event === 'ready') {
              setTimeout(() => callback(), 100);
            }
          }),
          end: jest.fn(),
          destroy: jest.fn()
        }))
      }));

      const connection = await sshService.connect(mockConfig);
      expect(connection).toBeDefined();
      expect(sshService.getConnection(mockConfig.id)).toBeDefined();
    });

    test('应该能够断开SSH连接', async () => {
      const mockConfig = {
        id: 'test-host-2',
        hostname: 'localhost',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'testpass'
      };

      await sshService.connect(mockConfig);
      await sshService.disconnect(mockConfig.id);
      
      expect(sshService.getConnection(mockConfig.id)).toBeUndefined();
    });

    test('连接失败时应该抛出错误', async () => {
      const mockConfig = {
        id: 'test-host-fail',
        hostname: 'invalid-host',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'wrongpass'
      };

      jest.doMock('ssh2', () => ({
        Client: jest.fn().mockImplementation(() => ({
          connect: jest.fn(),
          on: jest.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('连接失败')), 100);
            }
          }),
          destroy: jest.fn()
        }))
      }));

      await expect(sshService.connect(mockConfig)).rejects.toThrow('连接失败');
    });
  });

  describe('命令执行', () => {
    test('应该能够执行命令并返回结果', async () => {
      const mockConfig = {
        id: 'test-host-cmd',
        hostname: 'localhost',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'testpass'
      };

      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('test output')), 50);
          } else if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      jest.doMock('ssh2', () => ({
        Client: jest.fn().mockImplementation(() => ({
          connect: jest.fn(),
          on: jest.fn((event, callback) => {
            if (event === 'ready') {
              setTimeout(() => callback(), 50);
            }
          }),
          exec: jest.fn((cmd, callback) => {
            setTimeout(() => callback(null, mockStream), 50);
          }),
          end: jest.fn(),
          destroy: jest.fn()
        }))
      }));

      await sshService.connect(mockConfig);
      const result = await sshService.executeCommand(mockConfig.id, 'ls -la');
      
      expect(result).toBeDefined();
      expect(result.output).toBe('test output');
      expect(result.exitCode).toBe(0);
    });

    test('命令执行失败时应该返回错误', async () => {
      const mockConfig = {
        id: 'test-host-cmd-fail',
        hostname: 'localhost',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'testpass'
      };

      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('command not found')), 50);
          } else if (event === 'close') {
            setTimeout(() => callback(1), 100);
          }
        })
      };

      jest.doMock('ssh2', () => ({
        Client: jest.fn().mockImplementation(() => ({
          connect: jest.fn(),
          on: jest.fn((event, callback) => {
            if (event === 'ready') {
              setTimeout(() => callback(), 50);
            }
          }),
          exec: jest.fn((cmd, callback) => {
            setTimeout(() => callback(null, mockStream), 50);
          }),
          end: jest.fn(),
          destroy: jest.fn()
        }))
      }));

      await sshService.connect(mockConfig);
      const result = await sshService.executeCommand(mockConfig.id, 'invalidcmd');
      
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('command not found');
    });
  });

  describe('连接池管理', () => {
    test('应该复用已存在的连接', async () => {
      const mockConfig = {
        id: 'test-host-pool',
        hostname: 'localhost',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'testpass'
      };

      // 第一次连接
      const connection1 = await sshService.connect(mockConfig);
      // 第二次应该复用连接
      const connection2 = await sshService.connect(mockConfig);
      
      expect(connection1).toBe(connection2);
    });

    test('应该正确管理连接统计', async () => {
      const stats = sshService.getConnectionStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
    });
  });
});