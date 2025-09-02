<template>
  <div class="sidebar" :class="{ collapsed }">
    <!-- Logo区域 -->
    <div class="logo">
      <div class="logo-icon">T</div>
      <div class="logo-text" v-show="!collapsed">Temctl</div>
    </div>

    <!-- 导航菜单 -->
    <div class="nav-menu">
      <router-link 
        v-for="item in menuItems" 
        :key="item.name"
        :to="item.path" 
        class="nav-item"
        :class="{ active: $route.name === item.name }"
      >
        <div class="nav-icon">
          <el-icon><component :is="item.icon" /></el-icon>
        </div>
        <div class="nav-text" v-show="!collapsed">{{ item.title }}</div>
        <div class="nav-badge" v-if="item.badge" v-show="!collapsed">
          {{ item.badge }}
        </div>
      </router-link>
    </div>

    <!-- 侧边栏底部 -->
    <div class="sidebar-footer">
      <button class="toggle-btn" @click="toggleSidebar">
        <el-icon>
          <component :is="collapsed ? 'ArrowRight' : 'ArrowLeft'" />
        </el-icon>
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';

export default {
  name: 'AppSidebar',
  props: {
    collapsed: {
      type: Boolean,
      default: false
    }
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    const store = useStore();
    const route = useRoute();

    // 菜单项配置
    const menuItems = computed(() => [
      {
        name: 'Dashboard',
        path: '/',
        title: '仪表板',
        icon: 'Monitor'
      },
      {
        name: 'Connections',
        path: '/connections',
        title: '连接管理',
        icon: 'Link',
        badge: activeConnectionCount.value || null
      },
      {
        name: 'FileTransfer',
        path: '/files',
        title: '文件传输',
        icon: 'Folder'
      },
      {
        name: 'AIAssistant',
        path: '/ai',
        title: 'AI助手',
        icon: 'ChatDotRound'
      },
      {
        name: 'SecurityAudit',
        path: '/security',
        title: '安全审计',
        icon: 'Lock'
      },
      {
        name: 'OperationLogs',
        path: '/logs',
        title: '操作日志',
        icon: 'Document'
      },
      {
        name: 'Settings',
        path: '/settings',
        title: '设置',
        icon: 'Setting'
      }
    ]);

    // 活动连接数
    const activeConnectionCount = computed(() => {
      return store.getters['connections/activeConnectionCount'];
    });

    // 切换侧边栏
    const toggleSidebar = () => {
      emit('toggle');
      store.dispatch('app/toggleSidebar');
    };

    return {
      menuItems,
      activeConnectionCount,
      toggleSidebar
    };
  }
};
</script>