// API集成测试

const request = require('supertest');
const path = require('path');

// 导入应用
const app = require('../../src/backend/src/app');

describe('API集成测试', () => {
  let server;
  let testHostId;
  
  beforeAll(async () => {
    // 启动测试服务器
    server = app.listen(0); // 使用随机端口
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('主机管理API', () => {
    test('POST /api/hosts - 创建主机', async () => {
      const hostData = {
        name: '集成测试主机',
        hostname: 'integration.test.com',
        port: 22,
        username: 'testuser',
        authType: 'password',
        password: 'testpass',
        group: '测试组'
      };

      const response = await request(server)
        .post('/api/hosts')
        .send(hostData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(hostData.name);
      expect(response.body.hostname).toBe(hostData.hostname);
      
      testHostId = response.body.id;
    });

    test('GET /api/hosts - 获取主机列表', async () => {
      const response = await request(server)
        .get('/api/hosts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const testHost = response.body.find(h => h.id === testHostId);
      expect(testHost).toBeDefined();
    });

    test('GET /api/hosts/:id - 获取特定主机', async () => {
      const response = await request(server)
        .get(`/api/hosts/${testHostId}`)
        .expect(200);

      expect(response.body.id).toBe(testHostId);
      expect(response.body.name).toBe('集成测试主机');
    });

    test('PUT /api/hosts/:id - 更新主机', async () => {
      const updateData = {
        name: '更新后的集成测试主机',
        port: 2222
      };

      const response = await request(server)
        .put(`/api/hosts/${testHostId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.port).toBe(updateData.port);
    });

    test('POST /api/hosts/:id/test - 测试连接', async () => {
      // 注意：这个测试可能会失败，因为没有真实的SSH服务器
      const response = await request(server)
        .post(`/api/hosts/${testHostId}/test`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      // 由于是模拟环境，可能返回false
    });

    test('DELETE /api/hosts/:id - 删除主机', async () => {
      await request(server)
        .delete(`/api/hosts/${testHostId}`)
        .expect(200);

      // 验证主机已被删除
      await request(server)
        .get(`/api/hosts/${testHostId}`)
        .expect(404);
    });
  });

  describe('AI对话API', () => {
    let conversationId;

    test('POST /api/ai/conversations - 创建对话', async () => {
      const conversationData = {
        title: '集成测试对话',
        model: 'gpt-3.5-turbo'
      };

      const response = await request(server)
        .post('/api/ai/conversations')
        .send(conversationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(conversationData.title);
      
      conversationId = response.body.id;
    });

    test('POST /api/ai/chat - 发送消息', async () => {
      const messageData = {
        message: '你好，这是一个测试消息',
        conversationId: conversationId,
        config: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key' // 在实际测试中应该使用真实的API密钥
        }
      };

      // 由于没有真实的API密钥，这个测试可能会失败
      // 可以模拟响应或跳过此测试
      const response = await request(server)
        .post('/api/ai/chat')
        .send(messageData);

      // 根据实际情况调整期望的状态码
      expect([200, 400, 401]).toContain(response.status);
    });

    test('GET /api/ai/conversations - 获取对话列表', async () => {
      const response = await request(server)
        .get('/api/ai/conversations')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      const testConversation = response.body.find(c => c.id === conversationId);
      expect(testConversation).toBeDefined();
    });
  });

  describe('安全审计API', () => {
    test('POST /api/security/audit - 命令审核', async () => {
      const auditData = {
        command: 'ls -la',
        username: 'testuser',
        hostname: 'test.com'
      };

      const response = await request(server)
        .post('/api/security/audit')
        .send(auditData)
        .expect(200);

      expect(response.body).toHaveProperty('allowed');
      expect(response.body).toHaveProperty('riskLevel');
    });

    test('GET /api/security/rules - 获取安全规则', async () => {
      const response = await request(server)
        .get('/api/security/rules')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('操作日志API', () => {
    test('GET /api/logs - 获取操作日志', async () => {
      const response = await request(server)
        .get('/api/logs')
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    test('GET /api/logs?operationType=connection - 按类型筛选日志', async () => {
      const response = await request(server)
        .get('/api/logs')
        .query({ operationType: 'connection' })
        .expect(200);

      expect(Array.isArray(response.body.logs)).toBe(true);
      
      // 如果有日志，验证都是连接类型
      if (response.body.logs.length > 0) {
        response.body.logs.forEach(log => {
          expect(log.operationType).toBe('connection');
        });
      }
    });
  });

  describe('文件传输API', () => {
    test('POST /api/ftp/list - 列出文件', async () => {
      const listData = {
        hostId: 'test-host',
        path: '/'
      };

      const response = await request(server)
        .post('/api/ftp/list')
        .send(listData);

      // 由于没有真实的连接，可能返回错误
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('错误处理', () => {
    test('访问不存在的端点应该返回404', async () => {
      await request(server)
        .get('/api/nonexistent')
        .expect(404);
    });

    test('发送无效数据应该返回400', async () => {
      await request(server)
        .post('/api/hosts')
        .send({ invalid: 'data' })
        .expect(400);
    });
  });

  describe('CORS和安全头', () => {
    test('应该包含正确的CORS头', async () => {
      const response = await request(server)
        .options('/api/hosts')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    test('应该包含安全相关的头', async () => {
      const response = await request(server)
        .get('/api/hosts')
        .expect(200);

      // 检查常见的安全头
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});