<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>仪表板</h1>
      <p class="subtitle">欢迎使用 Temctl - 跨平台AI终端工具</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <StatCard
        title="主机总数"
        :value="stats.hosts.total"
        icon="Monitor"
        color="#409eff"
        :trend="{ value: '+2', label: '本周新增' }"
      />
      
      <StatCard
        title="活动连接"
        :value="stats.hosts.connected"
        icon="Link"
        color="#67c23a"
        :trend="{ value: stats.hosts.connected + '/' + stats.hosts.total, label: '连接率' }"
      />
      
      <StatCard
        title="文件传输"
        :value="stats.transfers.active"
        icon="Upload"
        color="#e6a23c"
        :trend="{ value: stats.transfers.completed, label: '已完成' }"
      />
      
      <StatCard
        title="AI对话"
        :value="stats.ai.sessions"
        icon="ChatDotRound"
        color="#f56c6c"
        :trend="{ value: stats.ai.messages, label: '总消息数' }"
      />
    </div>

    <!-- 主要功能区域 -->
    <div class="main-content">
      <!-- 快速操作 -->
      <el-card class="quick-actions" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>快速操作</span>
          </div>
        </template>
        
        <div class="action-buttons">
          <el-button type="primary" icon="Plus" @click="createNewConnection">
            新建连接
          </el-button>
          <el-button type="success" icon="ChatDotRound" @click="openAIAssistant">
            AI助手
          </el-button>
          <el-button type="warning" icon="Folder" @click="openFileTransfer">
            文件传输
          </el-button>
          <el-button type="info" icon="Setting" @click="openSettings">
            设置
          </el-button>
        </div>
      </el-card>

      <!-- 最近连接 -->
      <el-card class="recent-connections" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>最近连接</span>
            <el-button text @click="viewAllConnections">查看全部</el-button>
          </div>
        </template>

        <div class="connection-list" v-if="recentConnections.length > 0">
          <div 
            v-for="host in recentConnections" 
            :key="host.id"
            class="connection-item"
            @click="connectToHost(host)"
          >
            <div class="host-info">
              <div class="host-name">{{ host.name }}</div>
              <div class="host-address">{{ host.username }}@{{ host.hostname }}:{{ host.port }}</div>
            </div>
            
            <div class="connection-status">
              <el-tag 
                :type="getStatusType(host.status)"
                size="small"
              >
                {{ getStatusText(host.status) }}
              </el-tag>
            </div>
            
            <div class="connection-actions">
              <el-button 
                type="primary" 
                size="small"
                :loading="connectingHosts.includes(host.id)"
                @click.stop="connectToHost(host)"
              >
                {{ host.status === 'connected' ? '已连接' : '连接' }}
              </el-button>
            </div>
          </div>
        </div>
        
        <el-empty 
          v-else 
          description="暂无连接记录"
          :image-size="100"
        />
      </el-card>
    </div>

    <!-- 系统状态 -->
    <div class="system-status">
      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span>系统状态</span>
            <el-button text @click="refreshSystemStatus">刷新</el-button>
          </div>
        </template>
        
        <div class="status-grid">
          <div class="status-item">
            <div class="status-label">CPU使用率</div>
            <el-progress 
              :percentage="systemStatus.cpu" 
              :color="getProgressColor(systemStatus.cpu)"
              :show-text="true"
            />
          </div>
          
          <div class="status-item">
            <div class="status-label">内存使用率</div>
            <el-progress 
              :percentage="systemStatus.memory" 
              :color="getProgressColor(systemStatus.memory)"
              :show-text="true"
            />
          </div>
          
          <div class="status-item">
            <div class="status-label">网络状态</div>
            <div class="network-status">
              <el-tag 
                :type="systemStatus.network === 'online' ? 'success' : 'danger'"
                size="small"
              >
                {{ systemStatus.network === 'online' ? '在线' : '离线' }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import StatCard from '../components/common/StatCard.vue';

export default {
  name: 'Dashboard',
  components: {
    StatCard
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    
    const connectingHosts = ref([]);
    const systemStatus = ref({
      cpu: 45,
      memory: 68,
      network: 'online'
    });

    // 统计数据
    const stats = computed(() => ({
      hosts: store.getters['hosts/connectionStats'] || { total: 0, connected: 0 },
      transfers: {
        active: 0, // TODO: 从store获取
        completed: 0
      },
      ai: {
        sessions: 0, // TODO: 从store获取
        messages: 0
      }
    }));

    // 最近连接的主机
    const recentConnections = computed(() => {
      return store.state.hosts.hosts.slice(0, 5) || [];
    });

    // 连接到主机
    const connectToHost = async (host) => {
      if (host.status === 'connected') {
        // 如果已连接，跳转到终端页面
        router.push(`/connections/${host.id}`);
        return;
      }

      try {
        connectingHosts.value.push(host.id);
        
        // TODO: 实现SSH连接逻辑
        await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟连接延迟
        
        ElMessage.success(`成功连接到 ${host.name}`);
        
        // 更新主机状态
        await store.dispatch('hosts/updateHost', {
          id: host.id,
          updates: { status: 'connected', lastConnectedAt: new Date().toISOString() }
        });
        
        // 跳转到终端页面
        router.push(`/connections/${host.id}`);
        
      } catch (error) {
        ElMessage.error(`连接失败: ${error.message}`);
      } finally {
        connectingHosts.value = connectingHosts.value.filter(id => id !== host.id);
      }
    };

    // 获取状态类型
    const getStatusType = (status) => {
      const statusMap = {
        connected: 'success',
        connecting: 'warning',
        disconnected: 'info',
        error: 'danger'
      };
      return statusMap[status] || 'info';
    };

    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        connected: '已连接',
        connecting: '连接中',
        disconnected: '未连接',
        error: '连接错误'
      };
      return statusMap[status] || '未知';
    };

    // 获取进度条颜色
    const getProgressColor = (percentage) => {
      if (percentage < 50) return '#67c23a';
      if (percentage < 80) return '#e6a23c';
      return '#f56c6c';
    };

    // 快速操作方法
    const createNewConnection = () => {
      router.push('/connections/new');
    };

    const openAIAssistant = () => {
      router.push('/ai');
    };

    const openFileTransfer = () => {
      router.push('/files');
    };

    const openSettings = () => {
      router.push('/settings');
    };

    const viewAllConnections = () => {
      router.push('/connections');
    };

    const refreshSystemStatus = () => {
      // TODO: 实现系统状态刷新
      ElMessage.success('系统状态已刷新');
    };

    // 初始化数据
    onMounted(async () => {
      try {
        // 加载主机列表
        await store.dispatch('hosts/loadHosts');
        
        // 初始化应用状态
        await store.dispatch('app/initApp');
        
      } catch (error) {
        console.error('仪表板初始化失败:', error);
        ElMessage.error('数据加载失败，请刷新页面重试');
      }
    });

    return {
      stats,
      recentConnections,
      connectingHosts,
      systemStatus,
      connectToHost,
      getStatusType,
      getStatusText,
      getProgressColor,
      createNewConnection,
      openAIAssistant,
      openFileTransfer,
      openSettings,
      viewAllConnections,
      refreshSystemStatus
    };
  }
};
</script>

<style lang="scss" scoped>
.dashboard {
  padding: var(--space-lg);
  height: 100%;
  overflow-y: auto;
}

.dashboard-header {
  margin-bottom: var(--space-xl);
  
  h1 {
    font-size: var(--font-size-extra-large);
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: var(--space-sm);
  }
  
  .subtitle {
    color: var(--text-color-secondary);
    font-size: var(--font-size-base);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.quick-actions {
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    
    .el-button {
      justify-content: flex-start;
    }
  }
}

.recent-connections {
  .connection-list {
    .connection-item {
      display: flex;
      align-items: center;
      padding: var(--space-md);
      border-radius: var(--border-radius-base);
      cursor: pointer;
      transition: all var(--transition-duration);
      
      &:hover {
        background: var(--fill-color-light);
      }
      
      .host-info {
        flex: 1;
        
        .host-name {
          font-weight: 500;
          color: var(--text-color-primary);
          margin-bottom: 2px;
        }
        
        .host-address {
          font-size: var(--font-size-small);
          color: var(--text-color-secondary);
          font-family: monospace;
        }
      }
      
      .connection-status {
        margin-right: var(--space-md);
      }
      
      .connection-actions {
        .el-button {
          min-width: 80px;
        }
      }
    }
  }
}

.system-status {
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-lg);
    
    .status-item {
      .status-label {
        font-size: var(--font-size-small);
        color: var(--text-color-secondary);
        margin-bottom: var(--space-sm);
      }
      
      .network-status {
        display: flex;
        align-items: center;
        height: 32px;
      }
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  span {
    font-weight: 600;
    color: var(--text-color-primary);
  }
}

@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>