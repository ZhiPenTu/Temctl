// SSH连接管理状态
const state = {
  // 活动连接列表
  activeConnections: new Map(),
  
  // 连接历史
  connectionHistory: [],
  
  // 终端会话
  terminalSessions: new Map()
};

const mutations = {
  // 添加活动连接
  ADD_CONNECTION(state, { hostId, connection }) {
    state.activeConnections.set(hostId, connection);
  },
  
  // 移除连接
  REMOVE_CONNECTION(state, hostId) {
    state.activeConnections.delete(hostId);
  },
  
  // 添加连接历史
  ADD_CONNECTION_HISTORY(state, record) {
    state.connectionHistory.unshift(record);
  }
};

const actions = {
  // 建立SSH连接
  async connect({ commit }, host) {
    try {
      // 连接逻辑将在后续实现
      console.log('连接主机:', host);
    } catch (error) {
      console.error('连接失败:', error);
      throw error;
    }
  },
  
  // 断开连接
  async disconnect({ commit }, hostId) {
    try {
      commit('REMOVE_CONNECTION', hostId);
    } catch (error) {
      console.error('断开连接失败:', error);
    }
  }
};

const getters = {
  // 获取活动连接数
  activeConnectionCount: state => state.activeConnections.size
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};