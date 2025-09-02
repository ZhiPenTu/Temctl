// 文件传输状态管理
export default {
  namespaced: true,
  state: {
    activeTransfers: [], // 活动传输列表
    transferHistory: [], // 传输历史
    currentDirectory: {
      local: process.cwd ? process.cwd() : '/',
      remote: '/'
    },
    directoryContents: {
      local: [],
      remote: []
    },
    selectedFiles: {
      local: [],
      remote: []
    },
    transferSettings: {
      chunkSize: 65536,
      maxConcurrent: 5,
      autoRetry: true,
      retryCount: 3,
      verifyChecksum: true
    },
    transferStats: {
      totalUploads: 0,
      totalDownloads: 0,
      totalBytes: 0,
      successRate: 0
    }
  },
  
  mutations: {
    SET_ACTIVE_TRANSFERS(state, transfers) {
      state.activeTransfers = transfers;
    },
    
    ADD_TRANSFER(state, transfer) {
      state.activeTransfers.push(transfer);
    },
    
    UPDATE_TRANSFER(state, { transferId, updates }) {
      const index = state.activeTransfers.findIndex(t => t.id === transferId);
      if (index !== -1) {
        Object.assign(state.activeTransfers[index], updates);
      }
    },
    
    REMOVE_TRANSFER(state, transferId) {
      state.activeTransfers = state.activeTransfers.filter(t => t.id !== transferId);
    },
    
    SET_TRANSFER_HISTORY(state, history) {
      state.transferHistory = history;
    },
    
    SET_CURRENT_DIRECTORY(state, { type, path }) {
      state.currentDirectory[type] = path;
    },
    
    SET_DIRECTORY_CONTENTS(state, { type, contents }) {
      state.directoryContents[type] = contents;
    },
    
    SET_SELECTED_FILES(state, { type, files }) {
      state.selectedFiles[type] = files;
    },
    
    TOGGLE_FILE_SELECTION(state, { type, file }) {
      const selectedFiles = state.selectedFiles[type];
      const index = selectedFiles.findIndex(f => f.name === file.name);
      
      if (index === -1) {
        selectedFiles.push(file);
      } else {
        selectedFiles.splice(index, 1);
      }
    },
    
    CLEAR_FILE_SELECTION(state, type) {
      state.selectedFiles[type] = [];
    },
    
    UPDATE_TRANSFER_SETTINGS(state, settings) {
      Object.assign(state.transferSettings, settings);
    },
    
    SET_TRANSFER_STATS(state, stats) {
      state.transferStats = stats;
    }
  },
  
  actions: {
    // 获取活动传输
    async fetchActiveTransfers({ commit }) {
      try {
        const response = await this.$api.get('/ftp/active');
        if (response.data.success) {
          commit('SET_ACTIVE_TRANSFERS', response.data.data.transfers);
        }
      } catch (error) {
        console.error('获取活动传输失败:', error);
      }
    },
    
    // 获取传输历史
    async fetchTransferHistory({ commit }, { hostId, page = 1, limit = 20 }) {
      try {
        const params = { page, limit };
        if (hostId) params.hostId = hostId;
        
        const response = await this.$api.get('/ftp/transfers', { params });
        if (response.data.success) {
          commit('SET_TRANSFER_HISTORY', response.data.data.transfers);
        }
        return response.data;
      } catch (error) {
        console.error('获取传输历史失败:', error);
        throw error;
      }
    },
    
    // 获取目录内容
    async fetchDirectoryContents({ commit }, { type, path, hostId }) {
      try {
        if (type === 'local') {
          // 本地目录浏览
          const { ipcRenderer } = window.require('electron');
          const contents = await ipcRenderer.invoke('browse-directory', path);
          commit('SET_DIRECTORY_CONTENTS', { type, contents });
        } else {
          // 远程目录浏览 - 需要通过SSH连接
          const response = await this.$api.post('/ssh/exec', {
            hostId,
            command: `ls -la "${path}"`
          });
          
          if (response.data.success) {
            const contents = this.parseDirectoryListing(response.data.output);
            commit('SET_DIRECTORY_CONTENTS', { type, contents });
          }
        }
        
        commit('SET_CURRENT_DIRECTORY', { type, path });
      } catch (error) {
        console.error('获取目录内容失败:', error);
        throw error;
      }
    },
    
    // 上传文件
    async uploadFile({ commit, dispatch }, { hostId, localPath, remotePath, options = {} }) {
      try {
        const response = await this.$api.post('/ftp/upload', {
          hostId,
          localPath,
          remotePath,
          ...options
        });
        
        if (response.data.success) {
          // 添加到活动传输列表
          commit('ADD_TRANSFER', response.data.data);
          
          // 刷新活动传输状态
          dispatch('fetchActiveTransfers');
        }
        
        return response.data;
      } catch (error) {
        console.error('文件上传失败:', error);
        throw error;
      }
    },
    
    // 下载文件
    async downloadFile({ commit, dispatch }, { hostId, remotePath, localPath, options = {} }) {
      try {
        const response = await this.$api.post('/ftp/download', {
          hostId,
          remotePath,
          localPath,
          ...options
        });
        
        if (response.data.success) {
          // 添加到活动传输列表
          commit('ADD_TRANSFER', response.data.data);
          
          // 刷新活动传输状态
          dispatch('fetchActiveTransfers');
        }
        
        return response.data;
      } catch (error) {
        console.error('文件下载失败:', error);
        throw error;
      }
    },
    
    // 批量传输
    async batchTransfer({ commit, dispatch }, { hostId, transfers, options = {} }) {
      try {
        const response = await this.$api.post('/ftp/batch', {
          hostId,
          transfers,
          ...options
        });
        
        if (response.data.success) {
          // 刷新活动传输状态
          dispatch('fetchActiveTransfers');
        }
        
        return response.data;
      } catch (error) {
        console.error('批量传输失败:', error);
        throw error;
      }
    },
    
    // 暂停传输
    async pauseTransfer({ commit }, transferId) {
      try {
        const response = await this.$api.post(`/ftp/transfers/${transferId}/pause`);
        
        if (response.data.success) {
          commit('UPDATE_TRANSFER', {
            transferId,
            updates: { status: 'paused' }
          });
        }
        
        return response.data;
      } catch (error) {
        console.error('暂停传输失败:', error);
        throw error;
      }
    },
    
    // 恢复传输
    async resumeTransfer({ commit }, transferId) {
      try {
        const response = await this.$api.post(`/ftp/transfers/${transferId}/resume`);
        
        if (response.data.success) {
          commit('UPDATE_TRANSFER', {
            transferId,
            updates: { status: 'transferring' }
          });
        }
        
        return response.data;
      } catch (error) {
        console.error('恢复传输失败:', error);
        throw error;
      }
    },
    
    // 取消传输
    async cancelTransfer({ commit }, transferId) {
      try {
        const response = await this.$api.post(`/ftp/transfers/${transferId}/cancel`);
        
        if (response.data.success) {
          commit('REMOVE_TRANSFER', transferId);
        }
        
        return response.data;
      } catch (error) {
        console.error('取消传输失败:', error);
        throw error;
      }
    },
    
    // 删除传输记录
    async deleteTransfer({ dispatch }, transferId) {
      try {
        const response = await this.$api.delete(`/ftp/transfers/${transferId}`);
        
        if (response.data.success) {
          // 刷新传输历史
          dispatch('fetchTransferHistory', {});
        }
        
        return response.data;
      } catch (error) {
        console.error('删除传输记录失败:', error);
        throw error;
      }
    },
    
    // 获取传输统计
    async fetchTransferStats({ commit }, hostId) {
      try {
        const params = {};
        if (hostId) params.hostId = hostId;
        
        const response = await this.$api.get('/ftp/stats', { params });
        if (response.data.success) {
          commit('SET_TRANSFER_STATS', response.data.data.summary);
        }
        return response.data;
      } catch (error) {
        console.error('获取传输统计失败:', error);
        throw error;
      }
    },
    
    // 更新传输设置
    async updateTransferSettings({ commit }, settings) {
      try {
        // 保存到本地存储
        localStorage.setItem('transfer-settings', JSON.stringify(settings));
        commit('UPDATE_TRANSFER_SETTINGS', settings);
      } catch (error) {
        console.error('更新传输设置失败:', error);
        throw error;
      }
    },
    
    // 加载传输设置
    async loadTransferSettings({ commit }) {
      try {
        const settings = localStorage.getItem('transfer-settings');
        if (settings) {
          const parsed = JSON.parse(settings);
          commit('UPDATE_TRANSFER_SETTINGS', parsed);
        }
      } catch (error) {
        console.error('加载传输设置失败:', error);
      }
    },
    
    // 选择文件
    selectFiles({ commit }, { type, files }) {
      commit('SET_SELECTED_FILES', { type, files });
    },
    
    // 切换文件选择
    toggleFileSelection({ commit }, { type, file }) {
      commit('TOGGLE_FILE_SELECTION', { type, file });
    },
    
    // 清除文件选择
    clearFileSelection({ commit }, type) {
      commit('CLEAR_FILE_SELECTION', type);
    }
  },
  
  getters: {
    // 获取指定主机的传输
    transfersByHost: (state) => (hostId) => {
      return state.activeTransfers.filter(transfer => transfer.hostId === hostId);
    },
    
    // 获取正在进行的传输
    activeTransfersCount: (state) => {
      return state.activeTransfers.filter(t => 
        ['transferring', 'pending'].includes(t.status)
      ).length;
    },
    
    // 获取已选择文件的总大小
    selectedFilesSize: (state) => (type) => {
      return state.selectedFiles[type].reduce((total, file) => {
        return total + (file.size || 0);
      }, 0);
    },
    
    // 检查文件是否已选择
    isFileSelected: (state) => (type, fileName) => {
      return state.selectedFiles[type].some(f => f.name === fileName);
    },
    
    // 获取传输进度统计
    transferProgress: (state) => {
      if (state.activeTransfers.length === 0) return null;
      
      const totalSize = state.activeTransfers.reduce((sum, t) => sum + (t.fileSize || 0), 0);
      const transferredSize = state.activeTransfers.reduce((sum, t) => sum + (t.transferredSize || 0), 0);
      
      return {
        total: totalSize,
        transferred: transferredSize,
        percentage: totalSize > 0 ? (transferredSize / totalSize * 100).toFixed(2) : 0
      };
    }
  },
  
  // 辅助方法
  methods: {
    parseDirectoryListing(output) {
      // 解析 ls -la 输出
      const lines = output.split('\n').filter(line => line.trim());
      const files = [];
      
      for (let i = 1; i < lines.length; i++) { // 跳过第一行总计信息
        const line = lines[i].trim();
        const parts = line.split(/\s+/);
        
        if (parts.length >= 9) {
          const permissions = parts[0];
          const size = parseInt(parts[4]) || 0;
          const name = parts.slice(8).join(' ');
          
          if (name !== '.' && name !== '..') {
            files.push({
              name,
              size,
              type: permissions.startsWith('d') ? 'directory' : 'file',
              permissions,
              modified: `${parts[5]} ${parts[6]} ${parts[7]}`
            });
          }
        }
      }
      
      return files;
    }
  }
};