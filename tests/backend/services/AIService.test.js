// AI服务单元测试

const AIService = require('../../src/backend/src/services/AIService');

describe('AIService', () => {
  let aiService;
  
  beforeEach(() => {
    aiService = new AIService();
  });

  describe('OpenAI提供商', () => {
    test('应该能够发送消息到OpenAI', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: '这是AI的回复'
            }
          }]
        }
      };

      // 模拟axios请求
      jest.doMock('axios', () => ({
        post: jest.fn().mockResolvedValue(mockResponse),
        create: jest.fn(() => ({
          post: jest.fn().mockResolvedValue(mockResponse)
        }))
      }));

      const config = {
        provider: 'openai',
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo'
      };

      const result = await aiService.sendMessage('你好', config);
      
      expect(result).toBeDefined();
      expect(result.content).toBe('这是AI的回复');
    });

    test('API调用失败时应该抛出错误', async () => {
      jest.doMock('axios', () => ({
        post: jest.fn().mockRejectedValue(new Error('API调用失败')),
        create: jest.fn(() => ({
          post: jest.fn().mockRejectedValue(new Error('API调用失败'))
        }))
      }));

      const config = {
        provider: 'openai',
        apiKey: 'invalid-key',
        model: 'gpt-3.5-turbo'
      };

      await expect(aiService.sendMessage('你好', config)).rejects.toThrow('API调用失败');
    });
  });

  describe('本地模型提供商', () => {
    test('应该能够连接到Ollama服务', async () => {
      const mockResponse = {
        data: {
          message: {
            content: '这是本地模型的回复'
          }
        }
      };

      jest.doMock('axios', () => ({
        post: jest.fn().mockResolvedValue(mockResponse)
      }));

      const config = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2'
      };

      const result = await aiService.sendMessage('你好', config);
      
      expect(result).toBeDefined();
      expect(result.content).toBe('这是本地模型的回复');
    });
  });

  describe('消息历史管理', () => {
    test('应该能够保存和获取对话历史', async () => {
      const conversationId = 'test-conversation';
      const messages = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！有什么可以帮助你的吗？' }
      ];

      await aiService.saveConversation(conversationId, messages);
      const history = await aiService.getConversationHistory(conversationId);
      
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('你好');
      expect(history[1].content).toBe('你好！有什么可以帮助你的吗？');
    });

    test('应该能够清除对话历史', async () => {
      const conversationId = 'test-conversation-clear';
      const messages = [
        { role: 'user', content: '测试消息' }
      ];

      await aiService.saveConversation(conversationId, messages);
      await aiService.clearConversation(conversationId);
      
      const history = await aiService.getConversationHistory(conversationId);
      expect(history).toHaveLength(0);
    });
  });

  describe('配置验证', () => {
    test('应该验证OpenAI配置', () => {
      const validConfig = {
        provider: 'openai',
        apiKey: 'sk-test123',
        model: 'gpt-3.5-turbo'
      };

      const invalidConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo'
        // 缺少apiKey
      };

      expect(aiService.validateConfig(validConfig)).toBe(true);
      expect(aiService.validateConfig(invalidConfig)).toBe(false);
    });

    test('应该验证Ollama配置', () => {
      const validConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2'
      };

      const invalidConfig = {
        provider: 'ollama',
        model: 'llama2'
        // 缺少endpoint
      };

      expect(aiService.validateConfig(validConfig)).toBe(true);
      expect(aiService.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('流式响应', () => {
    test('应该支持流式响应处理', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // 模拟流式数据
            setTimeout(() => callback('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'), 50);
            setTimeout(() => callback('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'), 100);
            setTimeout(() => callback('data: [DONE]\n\n'), 150);
          } else if (event === 'end') {
            setTimeout(() => callback(), 200);
          }
        })
      };

      jest.doMock('https', () => ({
        request: jest.fn((options, callback) => {
          const response = mockStream;
          setTimeout(() => callback(response), 50);
          return {
            write: jest.fn(),
            end: jest.fn()
          };
        })
      }));

      const config = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        stream: true
      };

      const chunks = [];
      await aiService.sendMessageStream('你好', config, (chunk) => {
        chunks.push(chunk);
      });

      expect(chunks).toContain('你');
      expect(chunks).toContain('好');
    });
  });
});