<template>
  <div class="connection-detail">
    <div class="detail-header">
      <el-page-header @back="goBack" :content="host ? host.name : '连接详情'" />
    </div>

    <div class="detail-content" v-if="host">
      <!-- 连接信息卡片 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>连接信息</span>
            <el-button 
              type="primary" 
              :loading="connecting"
              @click="toggleConnection"
            >
              {{ host.status === 'connected' ? '断开连接' : '连接' }}
            </el-button>
          </div>
        </template>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="主机名">{{ host.name }}</el-descriptions-item>
          <el-descriptions-item label="地址">{{ host.hostname }}:{{ host.port }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ host.username }}</el-descriptions-item>
          <el-descriptions-item label="认证方式">
            {{ host.authType === 'password' ? '密码认证' : '密钥认证' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(host.status)">
              {{ getStatusText(host.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="分组">
            {{ host.group || '默认' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(host.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后连接">
            {{ host.lastConnectedAt ? formatDate(host.lastConnectedAt) : '从未连接' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 终端区域 -->
      <el-card class="terminal-card" shadow="hover" v-if="host.status === 'connected'">
        <template #header>
          <div class="card-header">
            <span>终端</span>
            <div class="terminal-actions">
              <el-button size="small" @click="clearTerminal">清屏</el-button>
              <el-button size="small" @click="showCommandHistory">历史命令</el-button>
              <el-button size="small" @click="openFileTransfer">文件传输</el-button>
            </div>
          </div>
        </template>

        <div class="terminal-container">
          <div class="terminal" ref="terminalRef">
            <div 
              v-for="(line, index) in terminalLines" 
              :key="index" 
              class="terminal-line"
              :class="{ 'command': line.type === 'command', 'output': line.type === 'output' }"
            >
              <span class="prompt" v-if="line.type === 'command'">{{ line.prompt }}</span>
              <span class="text">{{ line.text }}</span>
            </div>
          </div>

          <div class="terminal-input">
            <span class="prompt">{{ currentPrompt }}</span>
            <el-input
              v-model="currentCommand"
              @keyup.enter="executeCommand"
              @keyup.up="previousCommand"
              @keyup.down="nextCommand"
              placeholder="输入命令..."
              :loading="executing"
            />
          </div>
        </div>
      </el-card>
    </div>

    <!-- 加载状态 -->
    <el-skeleton v-else :rows="8" animated />

    <!-- 命令历史对话框 -->
    <el-dialog 
      v-model="historyVisible"
      title="命令历史"
      width="60%"
      :close-on-click-modal="false"
    >
      <div class="command-history">
        <div 
          v-for="(cmd, index) in commandHistory" 
          :key="index"
          class="history-item"
          @click="selectHistoryCommand(cmd)"
        >
          <div class="history-command">{{ cmd.command }}</div>
          <div class="history-time">{{ formatDate(cmd.timestamp) }}</div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="historyVisible = false">关闭</el-button>
        <el-button type="primary" @click="clearHistory">清空历史</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'ConnectionDetail',
  setup() {
    const store = useStore();
    const router = useRouter();
    const route = useRoute();

    const connecting = ref(false);
    const executing = ref(false);
    const historyVisible = ref(false);
    const terminalRef = ref(null);
    
    const currentCommand = ref('');
    const currentPrompt = ref('$ ');
    const terminalLines = ref([]);
    const commandHistory = ref([]);
    const historyIndex = ref(-1);

    // 获取主机信息
    const host = computed(() => {
      return store.state.hosts.hosts.find(h => h.id === route.params.id);
    });

    // 状态类型映射
    const getStatusType = (status) => {
      const statusMap = {
        connected: 'success',
        connecting: 'warning',
        disconnected: 'info',
        error: 'danger'
      };
      return statusMap[status] || 'info';
    };

    // 状态文本映射
    const getStatusText = (status) => {
      const statusMap = {
        connected: '已连接',
        connecting: '连接中',
        disconnected: '未连接',
        error: '连接错误'
      };
      return statusMap[status] || '未知';
    };

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    };

    // 返回上一页
    const goBack = () => {
      router.push('/connections');
    };

    // 切换连接状态
    const toggleConnection = async () => {
      if (!host.value) return;

      try {
        connecting.value = true;

        if (host.value.status === 'connected') {
          // 断开连接
          await store.dispatch('hosts/disconnectHost', host.value.id);
          terminalLines.value = [];
          ElMessage.success('连接已断开');
        } else {
          // 建立连接
          await store.dispatch('hosts/connectHost', host.value.id);
          
          // 初始化终端
          addTerminalLine('output', `连接到 ${host.value.name} (${host.value.hostname}:${host.value.port})`);
          addTerminalLine('output', `欢迎使用 ${host.value.name}`);
          
          ElMessage.success('连接成功');
        }
      } catch (error) {
        ElMessage.error(`操作失败: ${error.message}`);
      } finally {
        connecting.value = false;
      }
    };

    // 添加终端行
    const addTerminalLine = (type, text, prompt = '') => {
      terminalLines.value.push({
        type,
        text,
        prompt,
        timestamp: new Date()
      });
      
      // 滚动到底部
      nextTick(() => {
        if (terminalRef.value) {
          terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
        }
      });
    };

    // 执行命令
    const executeCommand = async () => {
      if (!currentCommand.value.trim() || executing.value) return;

      const command = currentCommand.value.trim();
      
      // 添加到终端显示
      addTerminalLine('command', command, currentPrompt.value);
      
      // 添加到历史记录
      commandHistory.value.unshift({
        command,
        timestamp: new Date().toISOString()
      });
      
      // 限制历史记录数量
      if (commandHistory.value.length > 100) {
        commandHistory.value = commandHistory.value.slice(0, 100);
      }

      try {
        executing.value = true;
        currentCommand.value = '';
        historyIndex.value = -1;

        // 发送命令到后端
        const result = await store.dispatch('hosts/executeCommand', {
          hostId: host.value.id,
          command
        });

        // 显示输出
        if (result.output) {
          result.output.split('\n').forEach(line => {
            addTerminalLine('output', line);
          });
        }

        // 更新提示符
        if (result.prompt) {
          currentPrompt.value = result.prompt;
        }

      } catch (error) {
        addTerminalLine('output', `错误: ${error.message}`);
      } finally {
        executing.value = false;
      }
    };

    // 上一个命令
    const previousCommand = () => {
      if (historyIndex.value < commandHistory.value.length - 1) {
        historyIndex.value++;
        currentCommand.value = commandHistory.value[historyIndex.value]?.command || '';
      }
    };

    // 下一个命令
    const nextCommand = () => {
      if (historyIndex.value > 0) {
        historyIndex.value--;
        currentCommand.value = commandHistory.value[historyIndex.value]?.command || '';
      } else if (historyIndex.value === 0) {
        historyIndex.value = -1;
        currentCommand.value = '';
      }
    };

    // 清屏
    const clearTerminal = () => {
      terminalLines.value = [];
    };

    // 显示命令历史
    const showCommandHistory = () => {
      historyVisible.value = true;
    };

    // 选择历史命令
    const selectHistoryCommand = (cmd) => {
      currentCommand.value = cmd.command;
      historyVisible.value = false;
    };

    // 清空历史
    const clearHistory = async () => {
      try {
        await ElMessageBox.confirm('确认清空命令历史吗？', '提示', {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: 'warning'
        });
        
        commandHistory.value = [];
        ElMessage.success('历史记录已清空');
        
      } catch {
        // 取消操作
      }
    };

    // 打开文件传输
    const openFileTransfer = () => {
      router.push('/files');
    };

    // 初始化
    onMounted(async () => {
      if (!host.value) {
        ElMessage.error('主机不存在');
        router.push('/connections');
        return;
      }

      // 加载主机详情
      try {
        await store.dispatch('hosts/loadHostDetail', route.params.id);
      } catch (error) {
        console.error('加载主机详情失败:', error);
      }
    });

    return {
      host,
      connecting,
      executing,
      historyVisible,
      terminalRef,
      currentCommand,
      currentPrompt,
      terminalLines,
      commandHistory,
      getStatusType,
      getStatusText,
      formatDate,
      goBack,
      toggleConnection,
      executeCommand,
      previousCommand,
      nextCommand,
      clearTerminal,
      showCommandHistory,
      selectHistoryCommand,
      clearHistory,
      openFileTransfer
    };
  }
};
</script>

<style lang="scss" scoped>
.connection-detail {
  padding: var(--space-lg);
  height: 100%;
  overflow-y: auto;
}

.detail-header {
  margin-bottom: var(--space-lg);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.info-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      font-weight: 600;
      color: var(--text-color-primary);
    }
  }
}

.terminal-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      font-weight: 600;
      color: var(--text-color-primary);
    }
    
    .terminal-actions {
      display: flex;
      gap: var(--space-sm);
    }
  }
}

.terminal-container {
  height: 400px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-base);
  background: #000;
  color: #00ff00;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  
  .terminal {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-md);
    
    .terminal-line {
      margin-bottom: 2px;
      word-wrap: break-word;
      
      &.command {
        .prompt {
          color: #ffff00;
          margin-right: var(--space-sm);
        }
        
        .text {
          color: #ffffff;
        }
      }
      
      &.output {
        .text {
          color: #00ff00;
        }
      }
    }
  }
  
  .terminal-input {
    display: flex;
    align-items: center;
    padding: var(--space-sm);
    border-top: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.8);
    
    .prompt {
      color: #ffff00;
      margin-right: var(--space-sm);
      font-size: 14px;
    }
    
    :deep(.el-input) {
      .el-input__wrapper {
        background: transparent;
        border: none;
        box-shadow: none;
        
        .el-input__inner {
          color: #ffffff;
          background: transparent;
          
          &::placeholder {
            color: #666666;
          }
        }
      }
    }
  }
}

.command-history {
  max-height: 400px;
  overflow-y: auto;
  
  .history-item {
    padding: var(--space-sm);
    border-bottom: 1px solid var(--border-color-lighter);
    cursor: pointer;
    transition: background var(--transition-duration);
    
    &:hover {
      background: var(--fill-color-light);
    }
    
    .history-command {
      font-family: monospace;
      font-size: 14px;
      color: var(--text-color-primary);
      margin-bottom: 2px;
    }
    
    .history-time {
      font-size: 12px;
      color: var(--text-color-secondary);
    }
  }
}
</style>