// 应用全局状态管理
const state = {
  // 应用初始化状态
  initialized: false,
  
  // 应用版本
  version: '1.0.0',
  
  // 当前主题
  theme: 'light',
  
  // 侧边栏状态
  sidebarCollapsed: false,
  
  // 全局加载状态
  loading: false,
  loadingText: '',
  
  // 网络连接状态
  online: navigator.onLine,
  
  // 应用配置
  config: {
    autoSave: true,
    autoConnect: false,
    checkUpdates: true,
    language: 'zh-CN'
  }
};

const mutations = {
  // 设置初始化状态
  SET_INITIALIZED(state, status) {
    state.initialized = status;
  },
  
  // 切换主题
  TOGGLE_THEME(state) {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
  },
  
  // 设置主题
  SET_THEME(state, theme) {
    state.theme = theme;
  },
  
  // 切换侧边栏
  TOGGLE_SIDEBAR(state) {
    state.sidebarCollapsed = !state.sidebarCollapsed;
  },
  
  // 设置侧边栏状态
  SET_SIDEBAR_COLLAPSED(state, collapsed) {
    state.sidebarCollapsed = collapsed;
  },
  
  // 设置全局加载状态
  SET_LOADING(state, { loading, text = '' }) {
    state.loading = loading;
    state.loadingText = text;
  },
  
  // 设置网络状态
  SET_ONLINE_STATUS(state, status) {
    state.online = status;
  },
  
  // 更新配置
  UPDATE_CONFIG(state, config) {
    state.config = { ...state.config, ...config };
  }
};

const actions = {
  // 初始化应用
  async initApp({ commit, dispatch }) {
    try {
      commit('SET_LOADING', { loading: true, text: '初始化应用...' });
      
      // 加载本地配置
      await dispatch('loadLocalConfig');
      
      // 应用主题
      await dispatch('applyTheme');
      
      // 监听网络状态
      dispatch('watchNetworkStatus');
      
      commit('SET_INITIALIZED', true);
    } catch (error) {
      console.error('应用初始化失败:', error);
      throw error;
    } finally {
      commit('SET_LOADING', { loading: false });
    }
  },
  
  // 加载本地配置
  async loadLocalConfig({ commit }) {
    try {
      const config = localStorage.getItem('app-config');
      if (config) {
        const parsedConfig = JSON.parse(config);
        commit('UPDATE_CONFIG', parsedConfig);
        
        // 应用主题设置
        if (parsedConfig.theme) {
          commit('SET_THEME', parsedConfig.theme);
        }
        
        // 应用侧边栏设置
        if (typeof parsedConfig.sidebarCollapsed === 'boolean') {
          commit('SET_SIDEBAR_COLLAPSED', parsedConfig.sidebarCollapsed);
        }
      }
    } catch (error) {
      console.error('加载本地配置失败:', error);
    }
  },
  
  // 保存配置到本地
  async saveLocalConfig({ state }) {
    try {
      const config = {
        ...state.config,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed
      };
      localStorage.setItem('app-config', JSON.stringify(config));
    } catch (error) {
      console.error('保存本地配置失败:', error);
    }
  },
  
  // 应用主题
  async applyTheme({ state }) {
    const html = document.documentElement;
    if (state.theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  },
  
  // 切换主题
  async toggleTheme({ commit, dispatch }) {
    commit('TOGGLE_THEME');
    await dispatch('applyTheme');
    await dispatch('saveLocalConfig');
  },
  
  // 切换侧边栏
  async toggleSidebar({ commit, dispatch }) {
    commit('TOGGLE_SIDEBAR');
    await dispatch('saveLocalConfig');
  },
  
  // 显示全局加载
  showLoading({ commit }, text = '加载中...') {
    commit('SET_LOADING', { loading: true, text });
  },
  
  // 隐藏全局加载
  hideLoading({ commit }) {
    commit('SET_LOADING', { loading: false });
  },
  
  // 监听网络状态
  watchNetworkStatus({ commit }) {
    const updateOnlineStatus = () => {
      commit('SET_ONLINE_STATUS', navigator.onLine);
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  },
  
  // 更新配置
  async updateConfig({ commit, dispatch }, config) {
    commit('UPDATE_CONFIG', config);
    await dispatch('saveLocalConfig');
  }
};

const getters = {
  // 是否为暗色主题
  isDarkTheme: state => state.theme === 'dark',
  
  // 是否在线
  isOnline: state => state.online,
  
  // 应用是否已初始化
  isInitialized: state => state.initialized,
  
  // 侧边栏是否收起
  isSidebarCollapsed: state => state.sidebarCollapsed
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};