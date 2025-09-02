const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const { AISession, AIMessage } = require('../models');

/**
 * AI服务基类
 */
class AIProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }

  async sendMessage(message, context = {}) {
    throw new Error('sendMessage方法必须由子类实现');
  }

  async generateSystemPrompt(context = {}) {
    return `你是Temctl的AI助手，一个专业的Linux系统管理和SSH终端操作助手。

你的主要职责：
1. 帮助用户生成安全、准确的Linux命令
2. 解释命令的作用和潜在风险
3. 提供系统管理最佳实践建议
4. 协助故障排查和问题解决

当前上下文：
- 操作系统: ${context.os || 'Linux'}
- 当前目录: ${context.pwd || '/home/user'}
- 用户权限: ${context.user || 'user'}
- 主机信息: ${context.hostname || 'localhost'}

安全准则：
- 对于危险命令（如rm -rf, mkfs, dd等），必须明确警告风险
- 建议使用sudo时要说明原因
- 提供命令的安全替代方案
- 不要生成可能损害系统的命令

请用中文回复，保持专业和友好的语气。`;
  }
}

/**
 * OpenAI服务提供商
 */
class OpenAIProvider extends AIProvider {
  constructor(options = {}) {
    super('openai', options);
    this.apiKey = options.apiKey || config.ai.openai.apiKey;
    this.baseURL = options.baseURL || config.ai.openai.baseURL;
    this.model = options.model || config.ai.openai.model;
    this.maxTokens = options.maxTokens || config.ai.openai.maxTokens;
    this.temperature = options.temperature || config.ai.openai.temperature;
  }

  async sendMessage(message, context = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API密钥未配置');
      }

      const systemPrompt = await this.generateSystemPrompt(context);
      
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // 添加历史消息
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }

      // 添加当前消息
      messages.push({ role: 'user', content: message });

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const choice = response.data.choices[0];
      
      return {
        content: choice.message.content,
        model: this.model,
        usage: response.data.usage,
        finishReason: choice.finish_reason
      };
    } catch (error) {
      logger.error('OpenAI API调用失败:', error);
      
      if (error.response) {
        const { status, data } = error.response;
        if (status === 401) {
          throw new Error('OpenAI API密钥无效');
        } else if (status === 429) {
          throw new Error('OpenAI API请求频率限制');
        } else {
          throw new Error(`OpenAI API错误: ${data.error?.message || '未知错误'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('OpenAI API请求超时');
      } else {
        throw new Error(`网络连接失败: ${error.message}`);
      }
    }
  }
}

/**
 * 本地模型服务提供商（Ollama）
 */
class LocalProvider extends AIProvider {
  constructor(options = {}) {
    super('local', options);
    this.endpoint = options.endpoint || config.ai.local.endpoint;
    this.model = options.model || config.ai.local.model;
  }

  async sendMessage(message, context = {}) {
    try {
      const systemPrompt = await this.generateSystemPrompt(context);
      
      const response = await axios.post(
        `${this.endpoint}/api/generate`,
        {
          model: this.model,
          prompt: `${systemPrompt}\n\nHuman: ${message}\n\nAssistant:`,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 本地模型可能需要更长时间
        }
      );

      return {
        content: response.data.response,
        model: this.model,
        usage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0
        },
        finishReason: 'stop'
      };
    } catch (error) {
      logger.error('本地模型调用失败:', error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('无法连接到本地模型服务，请确保Ollama正在运行');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('本地模型请求超时');
      } else {
        throw new Error(`本地模型错误: ${error.message}`);
      }
    }
  }

  async checkAvailability() {
    try {
      await axios.get(`${this.endpoint}/api/tags`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async listModels() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      logger.error('获取本地模型列表失败:', error);
      return [];
    }
  }
}

/**
 * AI服务管理器
 */
class AIService {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
    this.initProviders();
  }

  /**
   * 初始化AI服务提供商
   */
  initProviders() {
    // 注册OpenAI提供商
    this.registerProvider('openai', new OpenAIProvider());
    
    // 注册本地模型提供商
    this.registerProvider('local', new LocalProvider());
    
    // 设置默认提供商
    this.setDefaultProvider(config.ai.default_provider || 'openai');
  }

  /**
   * 注册AI服务提供商
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    logger.ai('AI服务提供商已注册:', name);
  }

  /**
   * 设置默认服务提供商
   */
  setDefaultProvider(name) {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
      logger.ai('默认AI服务提供商已设置:', name);
    } else {
      throw new Error(`未知的AI服务提供商: ${name}`);
    }
  }

  /**
   * 获取服务提供商
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`AI服务提供商不存在: ${providerName}`);
    }
    
    return provider;
  }

  /**
   * 创建AI对话会话
   */
  async createSession(options = {}) {
    try {
      const sessionModel = new AISession();
      
      const sessionData = {
        title: options.title || '新对话',
        hostId: options.hostId || null,
        provider: options.provider || this.defaultProvider,
        model: options.model || config.ai.openai.model,
        context: {
          systemInfo: options.systemInfo || {},
          preferences: options.preferences || {}
        }
      };

      const session = await sessionModel.createSession(sessionData);
      
      logger.ai('AI会话已创建', { sessionId: session.id, provider: sessionData.provider });
      
      return session;
    } catch (error) {
      logger.error('创建AI会话失败:', error);
      throw error;
    }
  }

  /**
   * 发送消息到AI
   */
  async sendMessage(sessionId, message, options = {}) {
    try {
      const sessionModel = new AISession();
      const messageModel = new AIMessage();
      
      // 获取会话信息
      const session = await sessionModel.getSessionWithMessages(sessionId);
      if (!session) {
        throw new Error('AI会话不存在');
      }

      // 获取AI服务提供商
      const provider = this.getProvider(session.provider);
      
      // 准备上下文
      const context = {
        ...session.context,
        history: session.messages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        ...options.context
      };

      // 记录用户消息
      await messageModel.addMessage({
        sessionId,
        role: 'user',
        content: message,
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: options.userAgent,
          ip: options.ip
        }
      });

      // 发送到AI服务
      const startTime = Date.now();
      const response = await provider.sendMessage(message, context);
      const responseTime = Date.now() - startTime;

      // 记录AI回复
      const aiMessage = await messageModel.addMessage({
        sessionId,
        role: 'assistant',
        content: response.content,
        metadata: {
          model: response.model,
          usage: response.usage,
          finishReason: response.finishReason
        },
        tokensUsed: response.usage?.total_tokens || 0,
        responseTime
      });

      // 更新会话时间
      await sessionModel.update(sessionId, {
        updated_at: new Date().toISOString()
      });

      logger.ai('AI消息处理完成', {
        sessionId,
        provider: session.provider,
        responseTime,
        tokensUsed: response.usage?.total_tokens || 0
      });

      return {
        messageId: aiMessage.id,
        content: response.content,
        usage: response.usage,
        responseTime
      };
    } catch (error) {
      logger.error('AI消息处理失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话消息历史
   */
  async getSessionHistory(sessionId, limit = 50) {
    try {
      const sessionModel = new AISession();
      const session = await sessionModel.getSessionWithMessages(sessionId);
      
      if (!session) {
        throw new Error('AI会话不存在');
      }

      // 返回最近的消息
      return {
        session: {
          id: session.id,
          title: session.title,
          provider: session.provider,
          model: session.model,
          createdAt: session.created_at,
          updatedAt: session.updated_at
        },
        messages: session.messages.slice(-limit)
      };
    } catch (error) {
      logger.error('获取会话历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的AI会话列表
   */
  async getUserSessions(hostId = null, limit = 20) {
    try {
      const sessionModel = new AISession();
      return await sessionModel.getUserSessions(hostId, limit);
    } catch (error) {
      logger.error('获取用户AI会话列表失败:', error);
      throw error;
    }
  }

  /**
   * 删除AI会话
   */
  async deleteSession(sessionId) {
    try {
      const sessionModel = new AISession();
      const messageModel = new AIMessage();
      
      // 删除会话消息
      await messageModel.deleteSessionMessages(sessionId);
      
      // 删除会话
      await sessionModel.delete(sessionId);
      
      logger.ai('AI会话已删除', { sessionId });
      
      return true;
    } catch (error) {
      logger.error('删除AI会话失败:', error);
      throw error;
    }
  }

  /**
   * 更新会话标题
   */
  async updateSessionTitle(sessionId, title) {
    try {
      const sessionModel = new AISession();
      await sessionModel.update(sessionId, { title });
      
      logger.ai('AI会话标题已更新', { sessionId, title });
      
      return true;
    } catch (error) {
      logger.error('更新会话标题失败:', error);
      throw error;
    }
  }

  /**
   * 获取AI使用统计
   */
  async getUsageStats(startDate = null, endDate = null) {
    try {
      const messageModel = new AIMessage();
      return await messageModel.getUsageStats(startDate, endDate);
    } catch (error) {
      logger.error('获取AI使用统计失败:', error);
      throw error;
    }
  }

  /**
   * 检查服务提供商可用性
   */
  async checkProviderAvailability(providerName = null) {
    try {
      const provider = this.getProvider(providerName);
      
      if (provider instanceof LocalProvider) {
        return await provider.checkAvailability();
      } else if (provider instanceof OpenAIProvider) {
        // 对于OpenAI，简单检查API密钥是否存在
        return !!provider.apiKey;
      }
      
      return true;
    } catch (error) {
      logger.error('检查AI服务可用性失败:', error);
      return false;
    }
  }

  /**
   * 获取可用的AI模型列表
   */
  async getAvailableModels(providerName = null) {
    try {
      const provider = this.getProvider(providerName);
      
      if (provider instanceof LocalProvider) {
        return await provider.listModels();
      } else if (provider instanceof OpenAIProvider) {
        // OpenAI模型列表（静态）
        return [
          { name: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' },
          { name: 'gpt-4', description: 'GPT-4' },
          { name: 'gpt-4-turbo', description: 'GPT-4 Turbo' }
        ];
      }
      
      return [];
    } catch (error) {
      logger.error('获取AI模型列表失败:', error);
      return [];
    }
  }
}

// 创建全局AI服务实例
const aiService = new AIService();

module.exports = aiService;