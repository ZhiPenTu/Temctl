<template>
  <div id="app" class="app-container">
    <!-- 应用标题栏 -->
    <AppTitleBar v-if="!isMacOS" />
    
    <!-- 主要内容区域 -->
    <div class="app-main">
      <!-- 侧边栏 -->
      <AppSidebar 
        :collapsed="sidebarCollapsed"
        @toggle="toggleSidebar"
      />
      
      <!-- 内容区域 -->
      <div class="app-content" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <router-view />
      </div>
    </div>

    <!-- 状态栏 -->
    <AppStatusBar />
    
    <!-- 全局加载遮罩 -->
    <el-loading 
      v-loading="globalLoading" 
      :text="loadingText"
      background="rgba(0, 0, 0, 0.7)"
    />
  </div>
</template>

<script>
import AppTitleBar from './components/layout/AppTitleBar.vue';
import AppSidebar from './components/layout/AppSidebar.vue';
import AppStatusBar from './components/layout/AppStatusBar.vue';

export default {
  name: 'App',
  components: {
    AppTitleBar,
    AppSidebar,
    AppStatusBar
  },
  data() {
    return {
      sidebarCollapsed: false,
      globalLoading: false,
      loadingText: '加载中...'
    };
  },
  computed: {
    isMacOS() {
      return process.platform === 'darwin';
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    
    // 显示全局加载
    showLoading(text = '加载中...') {
      this.loadingText = text;
      this.globalLoading = true;
    },
    
    // 隐藏全局加载
    hideLoading() {
      this.globalLoading = false;
    }
  },
  
  mounted() {
    // 监听Electron主进程消息
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // 监听菜单事件
      ipcRenderer.on('new-connection', () => {
        this.$router.push('/connections/new');
      });
      
      ipcRenderer.on('show-connection-manager', () => {
        this.$router.push('/connections');
      });
      
      ipcRenderer.on('toggle-ai-assistant', () => {
        this.$router.push('/ai');
      });
      
      ipcRenderer.on('show-file-transfer', () => {
        this.$router.push('/files');
      });
      
      ipcRenderer.on('open-preferences', () => {
        this.$router.push('/settings');
      });
    }
    
    // 应用启动初始化
    this.initApp();
  },
  
  methods: {
    async initApp() {
      try {
        this.showLoading('初始化应用...');
        
        // 初始化应用配置
        await this.$store.dispatch('app/initApp');
        
        // 加载用户配置
        await this.$store.dispatch('settings/loadSettings');
        
        // 加载主机列表
        await this.$store.dispatch('hosts/loadHosts');
        
      } catch (error) {
        console.error('应用初始化失败:', error);
        this.$message.error('应用初始化失败，请检查配置');
      } finally {
        this.hideLoading();
      }
    }
  }
};
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  margin-left: 240px;
  
  &.sidebar-collapsed {
    margin-left: 60px;
  }
}

// 滚动条样式
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--el-fill-color);
  border-radius: 4px;
  
  &:hover {
    background: var(--el-fill-color-dark);
  }
}

// Element Plus主题定制
.el-message {
  z-index: 10000;
}

.el-loading-mask {
  z-index: 9999;
}

// 暗色主题适配
.dark {
  .app-container {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
  }
}
</style>