<template>
  <div class="connections">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1>连接管理</h1>
        <p class="subtitle">管理您的SSH连接和主机信息</p>
      </div>
      
      <div class="header-actions">
        <el-button type="primary" icon="Plus" @click="showNewConnectionDialog">
          新建连接
        </el-button>
        <el-button icon="Refresh" @click="refreshConnections">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 筛选和搜索 -->
    <div class="filters">
      <div class="filter-left">
        <el-select 
          v-model="filters.groupId" 
          placeholder="选择分组" 
          clearable
          style="width: 200px"
          @change="handleFilterChange"
        >
          <el-option label="所有分组" value="" />
          <el-option 
            v-for="group in hostGroups" 
            :key="group.id"
            :label="group.name" 
            :value="group.id" 
          />
        </el-select>
        
        <el-select 
          v-model="filters.status" 
          placeholder="连接状态" 
          clearable
          style="width: 150px"
          @change="handleFilterChange"
        >
          <el-option label="所有状态" value="" />
          <el-option label="已连接" value="connected" />
          <el-option label="未连接" value="disconnected" />
          <el-option label="连接中" value="connecting" />
          <el-option label="错误" value="error" />
        </el-select>
        
        <el-select 
          v-model="filters.authType" 
          placeholder="认证方式" 
          clearable
          style="width: 150px"
          @change="handleFilterChange"
        >
          <el-option label="所有方式" value="" />
          <el-option label="密码认证" value="password" />
          <el-option label="密钥认证" value="key" />
          <el-option label="双因素" value="2fa" />
        </el-select>
      </div>
      
      <div class="filter-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索主机名、地址或标签"
          prefix-icon="Search"
          style="width: 300px"
          @input="handleSearch"
          clearable
        />
      </div>
    </div>

    <!-- 主机列表 -->
    <div class="hosts-content">
      <el-table
        :data="filteredHosts"
        v-loading="loading"
        :row-key="host => host.id"
        @row-click="handleRowClick"
        @selection-change="handleSelectionChange"
        stripe
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <div class="status-indicator">
              <div 
                class="status-dot" 
                :class="getStatusClass(row.status)"
              ></div>
              <span class="status-text">{{ getStatusText(row.status) }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="主机信息" min-width="200">
          <template #default="{ row }">
            <div class="host-info">
              <div class="host-name">
                <span>{{ row.name }}</span>
                <el-tag 
                  v-for="tag in parseTagsArray(row.tags)" 
                  :key="tag"
                  size="small"
                  style="margin-left: 8px"
                >
                  {{ tag }}
                </el-tag>
              </div>
              <div class="host-address">
                {{ row.username }}@{{ row.hostname }}:{{ row.port }}
              </div>
              <div class="host-description" v-if="row.description">
                {{ row.description }}
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="分组" width="120">
          <template #default="{ row }">
            <span v-if="getGroupName(row.group_id)">
              {{ getGroupName(row.group_id) }}
            </span>
            <span v-else class="text-secondary">未分组</span>
          </template>
        </el-table-column>
        
        <el-table-column label="认证方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag 
              :type="getAuthTypeTag(row.auth_type)"
              size="small"
            >
              {{ getAuthTypeName(row.auth_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="最后连接" width="160">
          <template #default="{ row }">
            <span v-if="row.last_connected_at">
              {{ formatDate(row.last_connected_at) }}
            </span>
            <span v-else class="text-secondary">从未连接</span>
          </template>
        </el-table-column>
        
        <el-table-column label="连接次数" width="100" align="center">
          <template #default="{ row }">
            {{ row.connection_count || 0 }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button 
                v-if="row.status !== 'connected'"
                type="primary" 
                size="small"
                :loading="connectingHosts.includes(row.id)"
                @click.stop="connectHost(row)"
              >
                连接
              </el-button>
              
              <el-button 
                v-else
                type="success" 
                size="small"
                @click.stop="openTerminal(row)"
              >
                终端
              </el-button>
              
              <el-dropdown @command="handleCommand">
                <el-button size="small" icon="More" circle />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      :command="{ action: 'edit', host: row }"
                      icon="Edit"
                    >
                      编辑
                    </el-dropdown-item>
                    <el-dropdown-item 
                      :command="{ action: 'test', host: row }"
                      icon="Connection"
                    >
                      测试连接
                    </el-dropdown-item>
                    <el-dropdown-item 
                      :command="{ action: 'duplicate', host: row }"
                      icon="CopyDocument"
                    >
                      复制
                    </el-dropdown-item>
                    <el-dropdown-item 
                      :command="{ action: 'delete', host: row }"
                      icon="Delete"
                      divided
                    >
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 新建/编辑连接对话框 -->
    <HostDialog
      v-model:visible="hostDialogVisible"
      :host="editingHost"
      :groups="hostGroups"
      @confirm="handleHostSave"
    />

    <!-- 批量操作栏 -->
    <div class="batch-actions" v-if="selectedHosts.length > 0">
      <div class="batch-info">
        已选择 {{ selectedHosts.length }} 个主机
      </div>
      <div class="batch-buttons">
        <el-button size="small" @click="batchConnect">批量连接</el-button>
        <el-button size="small" @click="batchDelete">批量删除</el-button>
        <el-button size="small" @click="clearSelection">清除选择</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import HostDialog from '../components/HostDialog.vue';

export default {
  name: 'Connections',
  components: {
    HostDialog
  },
  setup() {
    const store = useStore();
    const router = useRouter();

    // 响应式数据
    const loading = ref(false);
    const searchKeyword = ref('');
    const connectingHosts = ref([]);
    const selectedHosts = ref([]);
    const hostDialogVisible = ref(false);
    const editingHost = ref(null);
    
    // 筛选条件
    const filters = ref({
      groupId: '',
      status: '',
      authType: ''
    });
    
    // 分页配置
    const pagination = ref({
      page: 1,
      pageSize: 20,
      total: 0
    });

    // 计算属性
    const hosts = computed(() => store.state.hosts.hosts || []);
    const hostGroups = computed(() => store.state.hosts.groups || []);
    
    // 过滤后的主机列表
    const filteredHosts = computed(() => {
      let result = hosts.value;
      
      // 搜索关键词过滤
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        result = result.filter(host =>
          host.name.toLowerCase().includes(keyword) ||
          host.hostname.toLowerCase().includes(keyword) ||
          (host.tags && host.tags.toLowerCase().includes(keyword)) ||
          (host.description && host.description.toLowerCase().includes(keyword))
        );
      }
      
      // 分组过滤
      if (filters.value.groupId) {
        result = result.filter(host => host.group_id === filters.value.groupId);
      }
      
      // 状态过滤
      if (filters.value.status) {
        result = result.filter(host => host.status === filters.value.status);
      }
      
      // 认证方式过滤
      if (filters.value.authType) {
        result = result.filter(host => host.auth_type === filters.value.authType);
      }
      
      // 更新分页总数
      pagination.value.total = result.length;
      
      // 分页处理
      const start = (pagination.value.page - 1) * pagination.value.pageSize;
      const end = start + pagination.value.pageSize;
      
      return result.slice(start, end);
    });

    // 工具方法
    const parseTagsArray = (tags) => {
      if (!tags) return [];
      try {
        return Array.isArray(tags) ? tags : JSON.parse(tags);
      } catch {
        return [];
      }
    };

    const getStatusClass = (status) => {
      const statusMap = {
        connected: 'connected',
        connecting: 'connecting',
        disconnected: 'disconnected',
        error: 'error'
      };
      return statusMap[status] || 'disconnected';
    };

    const getStatusText = (status) => {
      const statusMap = {
        connected: '已连接',
        connecting: '连接中',
        disconnected: '未连接',
        error: '连接错误'
      };
      return statusMap[status] || '未知';
    };

    const getGroupName = (groupId) => {
      if (!groupId) return '';
      const group = hostGroups.value.find(g => g.id === groupId);
      return group ? group.name : '';
    };

    const getAuthTypeTag = (authType) => {
      const typeMap = {
        password: 'primary',
        key: 'success',
        '2fa': 'warning'
      };
      return typeMap[authType] || 'info';
    };

    const getAuthTypeName = (authType) => {
      const nameMap = {
        password: '密码',
        key: '密钥',
        '2fa': '2FA'
      };
      return nameMap[authType] || '未知';
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleString();
    };

    // 事件处理
    const handleSearch = () => {
      pagination.value.page = 1;
    };

    const handleFilterChange = () => {
      pagination.value.page = 1;
    };

    const handleRowClick = (row) => {
      if (row.status === 'connected') {
        openTerminal(row);
      }
    };

    const handleSelectionChange = (selection) => {
      selectedHosts.value = selection;
    };

    const handleSizeChange = (size) => {
      pagination.value.pageSize = size;
      pagination.value.page = 1;
    };

    const handleCurrentChange = (page) => {
      pagination.value.page = page;
    };

    const handleCommand = (command) => {
      const { action, host } = command;
      
      switch (action) {
        case 'edit':
          editHost(host);
          break;
        case 'test':
          testConnection(host);
          break;
        case 'duplicate':
          duplicateHost(host);
          break;
        case 'delete':
          deleteHost(host);
          break;
      }
    };

    // 操作方法
    const refreshConnections = async () => {
      loading.value = true;
      try {
        await store.dispatch('hosts/loadHosts');
        await store.dispatch('hosts/loadGroups');
        ElMessage.success('刷新成功');
      } catch (error) {
        ElMessage.error('刷新失败: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const showNewConnectionDialog = () => {
      editingHost.value = null;
      hostDialogVisible.value = true;
    };

    const connectHost = async (host) => {
      // TODO: 实现SSH连接逻辑
      connectingHosts.value.push(host.id);
      
      try {
        // 模拟连接延迟
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await store.dispatch('hosts/updateHost', {
          id: host.id,
          updates: { status: 'connected' }
        });
        
        ElMessage.success(`成功连接到 ${host.name}`);
        openTerminal(host);
        
      } catch (error) {
        ElMessage.error(`连接失败: ${error.message}`);
      } finally {
        connectingHosts.value = connectingHosts.value.filter(id => id !== host.id);
      }
    };

    const openTerminal = (host) => {
      router.push(`/connections/${host.id}`);
    };

    const editHost = (host) => {
      editingHost.value = { ...host };
      hostDialogVisible.value = true;
    };

    const testConnection = async (host) => {
      ElMessage.info('正在测试连接...');
      
      try {
        // TODO: 实现连接测试逻辑
        await new Promise(resolve => setTimeout(resolve, 1500));
        ElMessage.success('连接测试成功');
      } catch (error) {
        ElMessage.error('连接测试失败: ' + error.message);
      }
    };

    const duplicateHost = (host) => {
      const duplicatedHost = {
        ...host,
        name: host.name + ' - 副本',
        id: undefined // 让系统自动生成新ID
      };
      editingHost.value = duplicatedHost;
      hostDialogVisible.value = true;
    };

    const deleteHost = async (host) => {
      try {
        await ElMessageBox.confirm(
          `确定要删除主机 "${host.name}" 吗？此操作不可恢复。`,
          '确认删除',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
        
        await store.dispatch('hosts/deleteHost', host.id);
        ElMessage.success('删除成功');
        
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('删除失败: ' + error.message);
        }
      }
    };

    const handleHostSave = async (hostData) => {
      try {
        if (editingHost.value && editingHost.value.id) {
          // 编辑模式
          await store.dispatch('hosts/updateHost', {
            id: editingHost.value.id,
            updates: hostData
          });
          ElMessage.success('主机信息更新成功');
        } else {
          // 新建模式
          await store.dispatch('hosts/addHost', hostData);
          ElMessage.success('主机添加成功');
        }
        
        hostDialogVisible.value = false;
        editingHost.value = null;
        
      } catch (error) {
        ElMessage.error('保存失败: ' + error.message);
      }
    };

    const batchConnect = async () => {
      ElMessage.info('批量连接功能开发中...');
    };

    const batchDelete = async () => {
      try {
        await ElMessageBox.confirm(
          `确定要删除选中的 ${selectedHosts.value.length} 个主机吗？`,
          '批量删除',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
        
        // TODO: 实现批量删除
        ElMessage.success('批量删除成功');
        clearSelection();
        
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('批量删除失败');
        }
      }
    };

    const clearSelection = () => {
      selectedHosts.value = [];
    };

    // 生命周期
    onMounted(async () => {
      await refreshConnections();
    });

    return {
      loading,
      searchKeyword,
      connectingHosts,
      selectedHosts,
      hostDialogVisible,
      editingHost,
      filters,
      pagination,
      filteredHosts,
      hostGroups,
      parseTagsArray,
      getStatusClass,
      getStatusText,
      getGroupName,
      getAuthTypeTag,
      getAuthTypeName,
      formatDate,
      handleSearch,
      handleFilterChange,
      handleRowClick,
      handleSelectionChange,
      handleSizeChange,
      handleCurrentChange,
      handleCommand,
      refreshConnections,
      showNewConnectionDialog,
      connectHost,
      openTerminal,
      editHost,
      testConnection,
      duplicateHost,
      deleteHost,
      handleHostSave,
      batchConnect,
      batchDelete,
      clearSelection
    };
  }
};
</script>

<style lang="scss" scoped>
.connections {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-xl);
  
  .header-left {
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
  
  .header-actions {
    display: flex;
    gap: var(--space-md);
  }
}

.filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  
  .filter-left {
    display: flex;
    gap: var(--space-md);
  }
}

.hosts-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    
    &.connected {
      background: var(--success-color);
    }
    
    &.connecting {
      background: var(--warning-color);
      animation: pulse 2s infinite;
    }
    
    &.disconnected {
      background: var(--info-color);
    }
    
    &.error {
      background: var(--danger-color);
    }
  }
  
  .status-text {
    font-size: var(--font-size-small);
  }
}

.host-info {
  .host-name {
    font-weight: 500;
    color: var(--text-color-primary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
  }
  
  .host-address {
    font-size: var(--font-size-small);
    color: var(--text-color-secondary);
    font-family: monospace;
    margin-bottom: 2px;
  }
  
  .host-description {
    font-size: var(--font-size-small);
    color: var(--text-color-placeholder);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.action-buttons {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-lg) 0;
  border-top: 1px solid var(--border-color-lighter);
}

.batch-actions {
  position: fixed;
  bottom: var(--space-xl);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-color-overlay);
  border: 1px solid var(--border-color-lighter);
  border-radius: var(--border-radius-base);
  box-shadow: var(--box-shadow-dark);
  padding: var(--space-md) var(--space-lg);
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  z-index: 1000;
  
  .batch-info {
    color: var(--text-color-primary);
    font-weight: 500;
  }
  
  .batch-buttons {
    display: flex;
    gap: var(--space-sm);
  }
}

.text-secondary {
  color: var(--text-color-secondary);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: var(--space-md);
    
    .header-actions {
      align-self: stretch;
    }
  }
  
  .filters {
    flex-direction: column;
    gap: var(--space-md);
    
    .filter-left {
      flex-wrap: wrap;
    }
    
    .filter-right {
      align-self: stretch;
    }
  }
}
</style>