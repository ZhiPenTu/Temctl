<template>
  <div class="status-bar">
    <div class="status-left">
      <div class="status-item">
        <div class="status-indicator" :class="networkStatus"></div>
        <span>{{ networkStatusText }}</span>
      </div>
      
      <div class="status-item" v-if="connectionStats.total > 0">
        <el-icon><Link /></el-icon>
        <span>{{ connectionStats.connected }}/{{ connectionStats.total }} 已连接</span>
      </div>
      
      <div class="status-item" v-if="transferStats.active > 0">
        <el-icon><Download /></el-icon>
        <span>{{ transferStats.active }} 个传输任务</span>
      </div>
    </div>

    <div class="status-right">
      <div class="status-item" @click="showSystemInfo">
        <span>{{ systemInfo }}</span>
      </div>
      
      <div class="status-item">
        <span>{{ currentTime }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'AppStatusBar',
  setup() {
    const store = useStore();
    const currentTime = ref('');
    let timeInterval = null;

    // 网络状态
    const networkStatus = computed(() => {
      return store.getters['app/isOnline'] ? 'connected' : 'disconnected';
    });

    const networkStatusText = computed(() => {
      return store.getters['app/isOnline'] ? '在线' : '离线';
    });

    // 连接统计
    const connectionStats = computed(() => {
      return store.getters['hosts/connectionStats'];
    });

    // 传输统计
    const transferStats = computed(() => {
      return {
        active: 0, // TODO: 从store获取活动传输任务数
        completed: 0
      };
    });

    // 系统信息
    const systemInfo = computed(() => {
      const platform = process.platform;
      const version = process.env.VUE_APP_VERSION || '1.0.0';
      return `Temctl v${version} - ${platform}`;
    });

    // 更新时间
    const updateTime = () => {
      currentTime.value = new Date().toLocaleTimeString();
    };

    // 显示系统信息
    const showSystemInfo = () => {
      // TODO: 显示系统信息对话框
      console.log('显示系统信息');
    };

    onMounted(() => {
      updateTime();
      timeInterval = setInterval(updateTime, 1000);
    });

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval);
      }
    });

    return {
      networkStatus,
      networkStatusText,
      connectionStats,
      transferStats,
      systemInfo,
      currentTime,
      showSystemInfo
    };
  }
};
</script>