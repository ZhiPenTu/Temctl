// AI助手状态管理
export default {
  namespaced: true,
  state: {
    conversations: [],
    currentConversation: null,
    aiConfig: {
      provider: 'openai', // openai, local
      apiKey: '',
      model: 'gpt-3.5-turbo',
      endpoint: ''
    }
  },
  mutations: {},
  actions: {},
  getters: {}
};