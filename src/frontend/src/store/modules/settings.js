// 应用设置状态管理
export default {
  namespaced: true,
  state: {
    general: {
      language: 'zh-CN',
      theme: 'auto',
      autoSave: true,
      checkUpdates: true
    },
    terminal: {
      fontSize: 14,
      fontFamily: 'Monaco, Consolas, monospace',
      theme: 'dark',
      scrollback: 1000
    },
    security: {
      enableAudit: true,
      commandConfirm: true,
      sessionTimeout: 30
    },
    ai: {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      endpoint: ''
    }
  },
  mutations: {
    UPDATE_SETTINGS(state, { category, settings }) {
      state[category] = { ...state[category], ...settings };
    }
  },
  actions: {
    async loadSettings({ commit }) {
      try {
        const settings = localStorage.getItem('app-settings');
        if (settings) {
          const parsed = JSON.parse(settings);
          Object.keys(parsed).forEach(category => {
            commit('UPDATE_SETTINGS', { category, settings: parsed[category] });
          });
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    },
    
    async saveSettings({ state }) {
      try {
        localStorage.setItem('app-settings', JSON.stringify(state));
      } catch (error) {
        console.error('保存设置失败:', error);
      }
    },
    
    async updateSettings({ commit, dispatch }, { category, settings }) {
      commit('UPDATE_SETTINGS', { category, settings });
      await dispatch('saveSettings');
    }
  },
  getters: {}
};