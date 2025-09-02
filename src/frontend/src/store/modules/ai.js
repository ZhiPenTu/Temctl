// AI助手状态管理
export default {
  namespaced: true,
  state: {
    conversations: [], // AI对话列表
    currentConversation: null, // 当前对话
    messages: [], // 当前对话的消息列表
    isTyping: false, // AI是否正在输入
    availableModels: [], // 可用模型列表
    aiConfig: {
      provider: 'openai', // openai, local, claude, gemini
      apiKey: '',
      model: 'gpt-3.5-turbo',
      endpoint: '',
      temperature: 0.7,
      maxTokens: 1000
    },
    commandHistory: [], // 命令转换历史
    usageStats: {
      totalMessages: 0,
      totalTokens: 0,
      totalCommands: 0
    }
  },
  
  mutations: {
    SET_CONVERSATIONS(state, conversations) {
      state.conversations = conversations;
    },
    
    ADD_CONVERSATION(state, conversation) {
      state.conversations.unshift(conversation);
    },
    
    UPDATE_CONVERSATION(state, { id, updates }) {
      const index = state.conversations.findIndex(c => c.id === id);
      if (index !== -1) {
        Object.assign(state.conversations[index], updates);
      }
    },
    
    DELETE_CONVERSATION(state, id) {
      state.conversations = state.conversations.filter(c => c.id !== id);
      if (state.currentConversation?.id === id) {
        state.currentConversation = null;
        state.messages = [];
      }
    },
    
    SET_CURRENT_CONVERSATION(state, conversation) {
      state.currentConversation = conversation;
    },
    
    SET_MESSAGES(state, messages) {
      state.messages = messages;
    },
    
    ADD_MESSAGE(state, message) {
      state.messages.push(message);
    },
    
    UPDATE_MESSAGE(state, { index, updates }) {
      if (index >= 0 && index < state.messages.length) {
        Object.assign(state.messages[index], updates);
      }
    },
    
    REMOVE_MESSAGE(state, index) {
      if (index >= 0 && index < state.messages.length) {
        state.messages.splice(index, 1);
      }
    },
    
    SET_TYPING(state, typing) {
      state.isTyping = typing;
    },
    
    SET_AVAILABLE_MODELS(state, models) {
      state.availableModels = models;
    },
    
    UPDATE_AI_CONFIG(state, config) {
      Object.assign(state.aiConfig, config);
    },
    
    SET_COMMAND_HISTORY(state, history) {
      state.commandHistory = history;
    },
    
    ADD_COMMAND_HISTORY(state, item) {
      state.commandHistory.unshift(item);
    },
    
    SET_USAGE_STATS(state, stats) {
      state.usageStats = stats;
    }
  },
  
  actions: {
    // 获取对话列表
    async fetchConversations({ commit }) {
      try {
        const response = await this.$api.get('/ai/conversations');
        if (response.data.success) {
          commit('SET_CONVERSATIONS', response.data.data.conversations);
        }
      } catch (error) {
        console.error('获取对话列表失败:', error);
      }
    },
    
    // 创建新对话
    async createConversation({ commit }, { title, model, provider } = {}) {
      try {
        const conversation = {
          id: Date.now().toString(),
          title: title || '新对话',
          model: model || 'gpt-3.5-turbo',
          provider: provider || 'openai',
          createdAt: new Date().toISOString(),
          messageCount: 0
        };
        
        commit('ADD_CONVERSATION', conversation);
        commit('SET_CURRENT_CONVERSATION', conversation);
        commit('SET_MESSAGES', []);
        
        return conversation;
      } catch (error) {
        console.error('创建对话失败:', error);
        throw error;
      }
    },
    
    // 加载对话详情
    async loadConversation({ commit }, conversationId) {
      try {
        const response = await this.$api.get(`/ai/conversations/${conversationId}`);
        if (response.data.success) {
          const { conversation, messages } = response.data.data;
          commit('SET_CURRENT_CONVERSATION', conversation);
          commit('SET_MESSAGES', messages);
        }
      } catch (error) {
        console.error('加载对话失败:', error);
        throw error;
      }
    },
    
    // 发送消息
    async sendMessage({ commit, state }, { message, model, provider }) {
      try {
        commit('SET_TYPING', true);
        
        // 添加用户消息
        const userMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: message,
          timestamp: new Date().toISOString()
        };
        commit('ADD_MESSAGE', userMessage);
        
        // 发送到后端
        const response = await this.$api.post('/ai/chat', {
          message,
          sessionId: state.currentConversation?.id,
          model: model || state.aiConfig.model,
          provider: provider || state.aiConfig.provider
        });
        
        if (response.data.success) {
          // 添加AI回复
          const aiMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.data.data.response,
            timestamp: new Date().toISOString(),
            usage: response.data.data.usage
          };
          commit('ADD_MESSAGE', aiMessage);
          
          // 更新对话信息
          if (state.currentConversation) {
            commit('UPDATE_CONVERSATION', {
              id: state.currentConversation.id,
              updates: {
                messageCount: state.messages.length,
                updatedAt: new Date().toISOString()
              }
            });
          }
        }
        
        return response.data;
      } catch (error) {
        console.error('发送消息失败:', error);
        throw error;
      } finally {
        commit('SET_TYPING', false);
      }
    },
    
    // 删除对话
    async deleteConversation({ commit }, conversationId) {
      try {
        const response = await this.$api.delete(`/ai/conversations/${conversationId}`);
        if (response.data.success) {
          commit('DELETE_CONVERSATION', conversationId);
        }
      } catch (error) {
        console.error('删除对话失败:', error);
        throw error;
      }
    },
    
    // 获取可用模型
    async fetchAvailableModels({ commit }) {
      try {
        const response = await this.$api.get('/ai/models');
        if (response.data.success) {
          commit('SET_AVAILABLE_MODELS', response.data.data.models);
        }
      } catch (error) {
        console.error('获取可用模型失败:', error);
      }
    },
    
    // 翻译自然语言为命令
    async translateCommand({ commit }, { text, model, provider }) {
      try {
        const response = await this.$api.post('/commands/translate', {
          text,
          model: model || 'gpt-3.5-turbo',
          provider: provider || 'openai'
        });
        
        if (response.data.success) {
          const historyItem = {
            id: Date.now().toString(),
            originalText: text,
            translatedCommand: response.data.data.command,
            method: response.data.data.method,
            confidence: response.data.data.confidence,
            timestamp: new Date().toISOString()
          };
          
          commit('ADD_COMMAND_HISTORY', historyItem);
        }
        
        return response.data;
      } catch (error) {
        console.error('命令翻译失败:', error);
        throw error;
      }
    },
    
    // 获取命令历史
    async fetchCommandHistory({ commit }) {
      try {
        const response = await this.$api.get('/commands/history');
        if (response.data.success) {
          commit('SET_COMMAND_HISTORY', response.data.data.history);
        }
      } catch (error) {
        console.error('获取命令历史失败:', error);
      }
    },
    
    // 获取使用统计
    async fetchUsageStats({ commit }) {
      try {
        const response = await this.$api.get('/ai/stats');
        if (response.data.success) {
          commit('SET_USAGE_STATS', response.data.data);
        }
      } catch (error) {
        console.error('获取使用统计失败:', error);
      }
    },
    
    // 保存AI配置
    async saveAIConfig({ commit, state }) {
      try {
        // 保存到本地存储
        localStorage.setItem('ai-config', JSON.stringify(state.aiConfig));
      } catch (error) {
        console.error('保存AI配置失败:', error);
        throw error;
      }
    },
    
    // 加载AI配置
    async loadAIConfig({ commit }) {
      try {
        const config = localStorage.getItem('ai-config');
        if (config) {
          const parsed = JSON.parse(config);
          commit('UPDATE_AI_CONFIG', parsed);
        }
      } catch (error) {
        console.error('加载AI配置失败:', error);
      }
    },
    
    // 更新AI配置
    updateConfig({ commit, dispatch }, config) {
      commit('UPDATE_AI_CONFIG', config);
      dispatch('saveAIConfig');
    },
    
    // 清除消息
    clearMessages({ commit }) {
      commit('SET_MESSAGES', []);
    },
    
    // 重新生成回复
    async regenerateResponse({ commit, state }, messageIndex) {
      try {
        if (messageIndex <= 0 || messageIndex >= state.messages.length) {
          throw new Error('无效的消息索引');
        }
        
        const userMessage = state.messages[messageIndex - 1];
        if (userMessage.role !== 'user') {
          throw new Error('只能重新生成用户消息的回复');
        }
        
        commit('SET_TYPING', true);
        
        // 发送到后端重新生成
        const response = await this.$api.post('/ai/chat', {
          message: userMessage.content,
          sessionId: state.currentConversation?.id,
          model: state.aiConfig.model,
          provider: state.aiConfig.provider
        });
        
        if (response.data.success) {
          // 更新AI回复
          commit('UPDATE_MESSAGE', {
            index: messageIndex,
            updates: {
              content: response.data.data.response,
              timestamp: new Date().toISOString(),
              usage: response.data.data.usage
            }
          });
        }
        
        return response.data;
      } catch (error) {
        console.error('重新生成回复失败:', error);
        throw error;
      } finally {
        commit('SET_TYPING', false);
      }
    }
  },
  
  getters: {
    // 获取当前对话的消息数量
    currentMessageCount: (state) => {
      return state.messages.length;
    },
    
    // 获取最近的对话
    recentConversations: (state) => {
      return state.conversations.slice(0, 10);
    },
    
    // 获取当前提供商的可用模型
    availableModelsForProvider: (state) => (provider) => {
      return state.availableModels.filter(model => 
        model.provider === (provider || state.aiConfig.provider)
      );
    },
    
    // 检查是否可以发送消息
    canSendMessage: (state) => {
      return !state.isTyping && state.aiConfig.provider && (
        state.aiConfig.provider === 'local' || 
        (state.aiConfig.apiKey && state.aiConfig.model)
      );
    },
    
    // 获取最近的命令历史
    recentCommandHistory: (state) => {
      return state.commandHistory.slice(0, 20);
    }
  }
};