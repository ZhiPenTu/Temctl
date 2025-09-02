// 主机管理状态
const state = {
  // 主机列表
  hosts: [],
  
  // 主机分组
  groups: [],
  
  // 当前选中的主机
  selectedHost: null,
  
  // 搜索关键词
  searchKeyword: '',
  
  // 过滤条件
  filters: {
    status: 'all', // all, connected, disconnected
    group: 'all'
  },
  
  // 加载状态
  loading: false
};

const mutations = {
  // 设置主机列表
  SET_HOSTS(state, hosts) {
    state.hosts = hosts;
  },
  
  // 添加主机
  ADD_HOST(state, host) {
    state.hosts.push(host);
  },
  
  // 更新主机
  UPDATE_HOST(state, { id, updates }) {
    const index = state.hosts.findIndex(h => h.id === id);
    if (index !== -1) {
      state.hosts[index] = { ...state.hosts[index], ...updates };
    }
  },
  
  // 删除主机
  REMOVE_HOST(state, id) {
    const index = state.hosts.findIndex(h => h.id === id);
    if (index !== -1) {
      state.hosts.splice(index, 1);
    }
  },
  
  // 设置主机分组
  SET_GROUPS(state, groups) {
    state.groups = groups;
  },
  
  // 添加分组
  ADD_GROUP(state, group) {
    state.groups.push(group);
  },
  
  // 更新分组
  UPDATE_GROUP(state, { id, updates }) {
    const index = state.groups.findIndex(g => g.id === id);
    if (index !== -1) {
      state.groups[index] = { ...state.groups[index], ...updates };
    }
  },
  
  // 删除分组
  REMOVE_GROUP(state, id) {
    const index = state.groups.findIndex(g => g.id === id);
    if (index !== -1) {
      state.groups.splice(index, 1);
    }
  },
  
  // 设置选中的主机
  SET_SELECTED_HOST(state, host) {
    state.selectedHost = host;
  },
  
  // 设置搜索关键词
  SET_SEARCH_KEYWORD(state, keyword) {
    state.searchKeyword = keyword;
  },
  
  // 更新过滤条件
  UPDATE_FILTERS(state, filters) {
    state.filters = { ...state.filters, ...filters };
  },
  
  // 设置加载状态
  SET_LOADING(state, loading) {
    state.loading = loading;
  }
};

const actions = {
  // 加载主机列表
  async loadHosts({ commit }) {
    try {
      commit('SET_LOADING', true);
      
      // 从后端API加载主机列表
      // const response = await api.getHosts();
      // const hosts = response.data;
      
      // 临时使用本地存储的数据
      const hosts = JSON.parse(localStorage.getItem('hosts') || '[]');
      
      commit('SET_HOSTS', hosts);
    } catch (error) {
      console.error('加载主机列表失败:', error);
      throw error;
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // 添加主机
  async addHost({ commit, dispatch }, hostData) {
    try {
      // 生成主机ID
      const host = {
        ...hostData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'disconnected',
        lastConnectedAt: null
      };
      
      // 调用后端API创建主机
      // await api.createHost(host);
      
      commit('ADD_HOST', host);
      await dispatch('saveHostsToLocal');
      
      return host;
    } catch (error) {
      console.error('添加主机失败:', error);
      throw error;
    }
  },
  
  // 更新主机
  async updateHost({ commit, dispatch }, { id, updates }) {
    try {
      // 调用后端API更新主机
      // await api.updateHost(id, updates);
      
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      commit('UPDATE_HOST', { id, updates: updatedData });
      await dispatch('saveHostsToLocal');
    } catch (error) {
      console.error('更新主机失败:', error);
      throw error;
    }
  },
  
  // 删除主机
  async deleteHost({ commit, dispatch }, id) {
    try {
      // 调用后端API删除主机
      // await api.deleteHost(id);
      
      commit('REMOVE_HOST', id);
      await dispatch('saveHostsToLocal');
    } catch (error) {
      console.error('删除主机失败:', error);
      throw error;
    }
  },
  
  // 加载主机分组
  async loadGroups({ commit }) {
    try {
      // 从后端API或本地存储加载分组
      const groups = JSON.parse(localStorage.getItem('host-groups') || '[]');
      commit('SET_GROUPS', groups);
    } catch (error) {
      console.error('加载主机分组失败:', error);
    }
  },
  
  // 添加分组
  async addGroup({ commit, dispatch }, groupData) {
    try {
      const group = {
        ...groupData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      
      commit('ADD_GROUP', group);
      await dispatch('saveGroupsToLocal');
      
      return group;
    } catch (error) {
      console.error('添加分组失败:', error);
      throw error;
    }
  },
  
  // 更新分组
  async updateGroup({ commit, dispatch }, { id, updates }) {
    try {
      commit('UPDATE_GROUP', { id, updates });
      await dispatch('saveGroupsToLocal');
    } catch (error) {
      console.error('更新分组失败:', error);
      throw error;
    }
  },
  
  // 删除分组
  async deleteGroup({ commit, dispatch }, id) {
    try {
      commit('REMOVE_GROUP', id);
      await dispatch('saveGroupsToLocal');
    } catch (error) {
      console.error('删除分组失败:', error);
      throw error;
    }
  },
  
  // 保存主机到本地存储
  async saveHostsToLocal({ state }) {
    try {
      localStorage.setItem('hosts', JSON.stringify(state.hosts));
    } catch (error) {
      console.error('保存主机到本地失败:', error);
    }
  },
  
  // 保存分组到本地存储
  async saveGroupsToLocal({ state }) {
    try {
      localStorage.setItem('host-groups', JSON.stringify(state.groups));
    } catch (error) {
      console.error('保存分组到本地失败:', error);
    }
  },
  
  // 搜索主机
  searchHosts({ commit }, keyword) {
    commit('SET_SEARCH_KEYWORD', keyword);
  },
  
  // 更新过滤条件
  updateFilters({ commit }, filters) {
    commit('UPDATE_FILTERS', filters);
  }
};

const getters = {
  // 过滤后的主机列表
  filteredHosts: state => {
    let hosts = state.hosts;
    
    // 关键词搜索
    if (state.searchKeyword) {
      const keyword = state.searchKeyword.toLowerCase();
      hosts = hosts.filter(host => 
        host.name.toLowerCase().includes(keyword) ||
        host.hostname.toLowerCase().includes(keyword) ||
        (host.tags && host.tags.some(tag => tag.toLowerCase().includes(keyword)))
      );
    }
    
    // 状态过滤
    if (state.filters.status !== 'all') {
      hosts = hosts.filter(host => host.status === state.filters.status);
    }
    
    // 分组过滤
    if (state.filters.group !== 'all') {
      hosts = hosts.filter(host => host.groupId === state.filters.group);
    }
    
    return hosts;
  },
  
  // 根据ID获取主机
  getHostById: state => id => {
    return state.hosts.find(host => host.id === id);
  },
  
  // 根据分组ID获取主机
  getHostsByGroup: state => groupId => {
    return state.hosts.filter(host => host.groupId === groupId);
  },
  
  // 获取连接状态统计
  connectionStats: state => {
    const total = state.hosts.length;
    const connected = state.hosts.filter(h => h.status === 'connected').length;
    const disconnected = total - connected;
    
    return { total, connected, disconnected };
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};