// 数据库工具单元测试

const Database = require('../../src/backend/src/utils/database');
const path = require('path');

describe('Database', () => {
  let db;
  
  beforeEach(async () => {
    // 使用内存数据库进行测试
    db = new Database(':memory:');
    await db.init();
  });
  
  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('数据库连接', () => {
    test('应该能够初始化数据库', () => {
      expect(db).toBeDefined();
      expect(db.db).toBeDefined();
    });

    test('应该能够执行查询', async () => {
      const result = await db.query('SELECT 1 as test');
      expect(result).toHaveLength(1);
      expect(result[0].test).toBe(1);
    });

    test('应该能够执行插入操作', async () => {
      const insertResult = await db.run(
        'INSERT INTO hosts (name, hostname, port, username) VALUES (?, ?, ?, ?)',
        ['测试主机', 'localhost', 22, 'testuser']
      );
      
      expect(insertResult.lastID).toBeGreaterThan(0);
      expect(insertResult.changes).toBe(1);
    });
  });

  describe('主机管理', () => {
    test('应该能够创建主机记录', async () => {
      const hostData = {
        name: '测试主机',
        hostname: 'test.example.com',
        port: 22,
        username: 'admin',
        authType: 'password',
        group: '测试组'
      };

      const result = await db.createHost(hostData);
      expect(result.id).toBeDefined();
      
      const host = await db.getHost(result.id);
      expect(host.name).toBe(hostData.name);
      expect(host.hostname).toBe(hostData.hostname);
    });

    test('应该能够更新主机记录', async () => {
      // 先创建主机
      const hostData = {
        name: '原始主机',
        hostname: 'original.example.com',
        port: 22,
        username: 'admin'
      };

      const createResult = await db.createHost(hostData);
      
      // 更新主机信息
      const updateData = {
        name: '更新后主机',
        hostname: 'updated.example.com',
        port: 2222
      };

      await db.updateHost(createResult.id, updateData);
      
      const updatedHost = await db.getHost(createResult.id);
      expect(updatedHost.name).toBe(updateData.name);
      expect(updatedHost.hostname).toBe(updateData.hostname);
      expect(updatedHost.port).toBe(updateData.port);
    });

    test('应该能够删除主机记录', async () => {
      const hostData = {
        name: '待删除主机',
        hostname: 'delete.example.com',
        port: 22,
        username: 'admin'
      };

      const createResult = await db.createHost(hostData);
      const hostId = createResult.id;
      
      await db.deleteHost(hostId);
      
      const deletedHost = await db.getHost(hostId);
      expect(deletedHost).toBeUndefined();
    });

    test('应该能够按组查询主机', async () => {
      const group1Hosts = [
        { name: '主机1', hostname: 'host1.com', port: 22, username: 'admin', group: '组1' },
        { name: '主机2', hostname: 'host2.com', port: 22, username: 'admin', group: '组1' }
      ];
      
      const group2Hosts = [
        { name: '主机3', hostname: 'host3.com', port: 22, username: 'admin', group: '组2' }
      ];

      // 创建测试数据
      for (const host of [...group1Hosts, ...group2Hosts]) {
        await db.createHost(host);
      }

      const group1Results = await db.getHostsByGroup('组1');
      const group2Results = await db.getHostsByGroup('组2');
      
      expect(group1Results).toHaveLength(2);
      expect(group2Results).toHaveLength(1);
    });
  });

  describe('AI对话管理', () => {
    test('应该能够保存对话记录', async () => {
      const conversationData = {
        title: '测试对话',
        model: 'gpt-3.5-turbo',
        messages: JSON.stringify([
          { role: 'user', content: '你好' },
          { role: 'assistant', content: '你好！有什么可以帮助你的？' }
        ])
      };

      const result = await db.createConversation(conversationData);
      expect(result.id).toBeDefined();
      
      const conversation = await db.getConversation(result.id);
      expect(conversation.title).toBe(conversationData.title);
      expect(JSON.parse(conversation.messages)).toHaveLength(2);
    });

    test('应该能够更新对话记录', async () => {
      const conversationData = {
        title: '原始对话',
        model: 'gpt-3.5-turbo',
        messages: JSON.stringify([])
      };

      const createResult = await db.createConversation(conversationData);
      
      const updateData = {
        title: '更新后对话',
        messages: JSON.stringify([
          { role: 'user', content: '新消息' }
        ])
      };

      await db.updateConversation(createResult.id, updateData);
      
      const updatedConversation = await db.getConversation(createResult.id);
      expect(updatedConversation.title).toBe(updateData.title);
      expect(JSON.parse(updatedConversation.messages)).toHaveLength(1);
    });
  });

  describe('审计日志', () => {
    test('应该能够记录操作日志', async () => {
      const logData = {
        operationType: 'connection',
        username: 'testuser',
        hostname: 'test.example.com',
        description: '连接到测试主机',
        result: 'success',
        details: JSON.stringify({ connectionId: 'test-123' })
      };

      const result = await db.createOperationLog(logData);
      expect(result.id).toBeDefined();
      
      const log = await db.getOperationLog(result.id);
      expect(log.operationType).toBe(logData.operationType);
      expect(log.result).toBe(logData.result);
    });

    test('应该能够按条件查询日志', async () => {
      const logs = [
        {
          operationType: 'connection',
          username: 'user1',
          hostname: 'host1.com',
          description: '连接操作1',
          result: 'success'
        },
        {
          operationType: 'command',
          username: 'user1',
          hostname: 'host1.com',
          description: '命令执行',
          result: 'error'
        },
        {
          operationType: 'connection',
          username: 'user2',
          hostname: 'host2.com',
          description: '连接操作2',
          result: 'success'
        }
      ];

      // 创建测试日志
      for (const log of logs) {
        await db.createOperationLog(log);
      }

      // 按操作类型查询
      const connectionLogs = await db.getOperationLogs({ operationType: 'connection' });
      expect(connectionLogs).toHaveLength(2);

      // 按用户查询
      const user1Logs = await db.getOperationLogs({ username: 'user1' });
      expect(user1Logs).toHaveLength(2);

      // 按结果查询
      const errorLogs = await db.getOperationLogs({ result: 'error' });
      expect(errorLogs).toHaveLength(1);
    });
  });

  describe('事务处理', () => {
    test('应该支持事务操作', async () => {
      await db.beginTransaction();
      
      try {
        await db.createHost({
          name: '事务测试主机1',
          hostname: 'trans1.com',
          port: 22,
          username: 'admin'
        });
        
        await db.createHost({
          name: '事务测试主机2',
          hostname: 'trans2.com',
          port: 22,
          username: 'admin'
        });
        
        await db.commitTransaction();
        
        const hosts = await db.getAllHosts();
        const transHosts = hosts.filter(h => h.name.includes('事务测试'));
        expect(transHosts).toHaveLength(2);
        
      } catch (error) {
        await db.rollbackTransaction();
        throw error;
      }
    });

    test('事务回滚应该撤销所有更改', async () => {
      const initialHostCount = await db.query('SELECT COUNT(*) as count FROM hosts');
      
      await db.beginTransaction();
      
      try {
        await db.createHost({
          name: '回滚测试主机',
          hostname: 'rollback.com',
          port: 22,
          username: 'admin'
        });
        
        // 故意抛出错误
        throw new Error('测试错误');
        
      } catch (error) {
        await db.rollbackTransaction();
      }
      
      const finalHostCount = await db.query('SELECT COUNT(*) as count FROM hosts');
      expect(finalHostCount[0].count).toBe(initialHostCount[0].count);
    });
  });
});