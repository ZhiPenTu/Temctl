<template>
  <div class="app-sidebar" :class="{ collapsed }">
    <!-- Logo区域 -->
    <div class="sidebar-header">
      <div class="logo" v-if="!collapsed">
        <el-icon class="logo-icon"><Monitor /></el-icon>
        <span class="logo-text">Temctl</span>
      </div>
      <el-icon v-else class="logo-icon-collapsed"><Monitor /></el-icon>
    </div>
    
    <!-- 导航菜单 -->
    <div class="sidebar-nav">
      <el-menu
        :default-active="activeRoute"
        :collapse="collapsed"
        :router="true"
        background-color="transparent"
        text-color="var(--el-text-color-primary)"
        active-text-color="var(--el-color-primary)">
        
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <template #title>仪表板</template>
        </el-menu-item>
        
        <el-sub-menu index="/hosts">
          <template #title>
            <el-icon><Monitor /></el-icon>
            <span>主机管理</span>
          </template>
          <el-menu-item index="/hosts">主机列表</el-menu-item>
          <el-menu-item index="/hosts/groups">主机分组</el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="/terminal">
          <el-icon><Monitor /></el-icon>
          <template #title>SSH终端</template>
        </el-menu-item>
        
        <el-menu-item index="/files">
          <el-icon><Folder /></el-icon>
          <template #title>文件传输</template>
        </el-menu-item>
        
        <el-sub-menu index="/ai">
          <template #title>
            <el-icon><ChatRound /></el-icon>
            <span>AI助手</span>
          </template>
          <el-menu-item index="/ai/chat">AI对话</el-menu-item>
          <el-menu-item index="/ai/commands">命令翻译</el-menu-item>
        </el-sub-menu>
        
        <el-sub-menu index="/security">
          <template #title>
            <el-icon><Lock /></el-icon>
            <span>安全管控</span>
          </template>
          <el-menu-item index="/security/rules">安全规则</el-menu-item>
          <el-menu-item index="/security/audit">审计日志</el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>设置</template>
        </el-menu-item>
      </el-menu>
    </div>
    
    <!-- 底部操作区 -->
    <div class="sidebar-footer">
      <div class="connection-status" v-if="!collapsed">
        <div class="status-item">
          <el-icon class="status-icon" :class="{ online: isOnline }">
            <Connection />
          </el-icon>
          <span class="status-text">{{ connectionStatusText }}</span>
        </div>
        <div class="active-connections" v-if="activeConnections > 0">
          <el-tag size="small" type="success">
            {{ activeConnections }} 个连接
          </el-tag>
        </div>
      </div>
      
      <el-button 
        text 
        :icon="collapsed ? Expand : Fold" 
        @click="$emit('toggle')"
        class="toggle-btn" />
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import {
  Monitor,
  Odometer,
  Folder,
  ChatRound,
  Lock,
  Setting,
  Connection,
  Expand,
  Fold
} from '@element-plus/icons-vue'

export default {
  name: 'AppSidebar',
  props: {
    collapsed: {
      type: Boolean,
      default: false
    }
  },
  emits: ['toggle'],
  setup() {
    const route = useRoute()
    const store = useStore()
    
    // 计算属性
    const activeRoute = computed(() => {
      return route.path
    })
    
    const isOnline = computed(() => {
      return navigator.onLine
    })
    
    const connectionStatusText = computed(() => {
      return isOnline.value ? '在线' : '离线'
    })
    
    const activeConnections = computed(() => {
      return store.getters['connections/activeConnectionsCount'] || 0
    })
    
    return {
      // 图标
      Monitor,
      Odometer,
      Folder,
      ChatRound,
      Lock,
      Setting,
      Connection,
      Expand,
      Fold,
      
      // 计算属性
      activeRoute,
      isOnline,
      connectionStatusText,
      activeConnections
    }
  }
}
</script>

<style lang="scss" scoped>
.app-sidebar {
  width: 240px;
  height: 100vh;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  transition: width 0.3s ease;
  
  &.collapsed {
    width: 60px;
  }
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .logo-icon {
      font-size: 24px;
      color: var(--el-color-primary);
    }
    
    .logo-text {
      font-size: 18px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
  
  .logo-icon-collapsed {
    font-size: 24px;
    color: var(--el-color-primary);
  }
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  
  :deep(.el-menu) {
    border-right: none;
    
    .el-menu-item {
      margin: 4px 8px;
      border-radius: 6px;
      
      &:hover {
        background-color: var(--el-fill-color-light);
      }
      
      &.is-active {
        background-color: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
        
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-color: var(--el-color-primary);
        }
      }
    }
    
    .el-sub-menu {
      margin: 4px 8px;
      border-radius: 6px;
      
      .el-sub-menu__title {
        border-radius: 6px;
        
        &:hover {
          background-color: var(--el-fill-color-light);
        }
      }
      
      .el-menu {
        background-color: transparent;
        
        .el-menu-item {
          margin: 2px 16px;
          padding-left: 40px !important;
        }
      }
    }
  }
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--el-border-color);
  
  .connection-status {
    margin-bottom: 12px;
    
    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      
      .status-icon {
        font-size: 14px;
        color: var(--el-text-color-placeholder);
        
        &.online {
          color: var(--el-color-success);
        }
      }
      
      .status-text {
        font-size: 12px;
        color: var(--el-text-color-regular);
      }
    }
    
    .active-connections {
      text-align: center;
    }
  }
  
  .toggle-btn {
    width: 100%;
    justify-content: center;
  }
}

.collapsed {
  .sidebar-nav {
    :deep(.el-menu) {
      .el-menu-item,
      .el-sub-menu .el-sub-menu__title {
        padding: 0 20px !important;
        justify-content: center;
      }
    }
  }
  
  .sidebar-footer {
    .connection-status {
      display: none;
    }
  }
}
</style>