<template>
  <div class="ai-chat-container">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <h3 v-if="!sidebarCollapsed">AI助手</h3>
        <el-button 
          text 
          :icon="sidebarCollapsed ? Expand : Fold" 
          @click="toggleSidebar" />
      </div>
      
      <div class="sidebar-content" v-if="!sidebarCollapsed">
        <!-- 新建对话按钮 -->
        <el-button 
          type="primary" 
          :icon="Plus" 
          class="new-chat-btn"
          @click="createNewConversation">
          新建对话
        </el-button>
        
        <!-- 对话列表 -->
        <div class="conversation-list">
          <div class="list-header">
            <span>对话历史</span>
            <el-button 
              text 
              size="small" 
              :icon="Refresh" 
              @click="fetchConversations" />
          </div>
          <el-scrollbar height="calc(100vh - 200px)">
            <div 
              class="conversation-item"
              :class="{ active: conv.id === currentConversation?.id }"
              v-for="conv in conversations" 
              :key="conv.id"
              @click="loadConversation(conv.id)">
              <div class="conv-title">{{ conv.title }}</div>
              <div class="conv-meta">
                <span class="conv-count">{{ conv.messageCount }}条消息</span>
                <span class="conv-time">{{ formatRelativeTime(conv.updatedAt) }}</span>
              </div>
              <el-button 
                text 
                size="small" 
                :icon="Delete" 
                class="delete-btn"
                @click.stop="deleteConversation(conv.id)" />
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="chat-area">
      <!-- 聊天头部 -->
      <div class="chat-header">
        <div class="chat-title">
          <h3>{{ currentConversation?.title || 'AI助手' }}</h3>
          <el-tag size="small" type="info">
            {{ aiConfig.provider }} - {{ aiConfig.model }}
          </el-tag>
        </div>
        <div class="chat-actions">
          <el-button 
            text 
            :icon="Setting" 
            @click="showConfigDialog = true">
            设置
          </el-button>
          <el-button 
            text 
            :icon="Delete" 
            @click="clearMessages"
            :disabled="messages.length === 0">
            清空
          </el-button>
          <el-dropdown @command="handleDropdownCommand">
            <el-button text :icon="MoreFilled" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="export" :icon="Download">
                  导出对话
                </el-dropdown-item>
                <el-dropdown-item command="translate" :icon="MagicStick">
                  命令翻译
                </el-dropdown-item>
                <el-dropdown-item command="stats" :icon="DataAnalysis">
                  使用统计
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="message-list" ref="messageListRef">
        <el-scrollbar ref="scrollbarRef" always>
          <div class="messages-container">
            <!-- 欢迎消息 -->
            <div class="welcome-message" v-if="messages.length === 0">
              <div class="welcome-content">
                <el-icon class="welcome-icon"><Robot /></el-icon>
                <h2>欢迎使用AI助手</h2>
                <p>我可以帮助您进行对话、翻译命令、解答问题等。开始对话吧！</p>
                <div class="quick-actions">
                  <el-button @click="sendQuickMessage('帮我列出当前目录的文件')">
                    列出文件
                  </el-button>
                  <el-button @click="sendQuickMessage('如何查看系统信息？')">
                    系统信息
                  </el-button>
                  <el-button @click="sendQuickMessage('解释这个命令: ls -la')">
                    命令解释
                  </el-button>
                </div>
              </div>
            </div>

            <!-- 消息项 -->
            <message-item
              v-for="(message, index) in messages"
              :key="message.id"
              :message="message"
              :index="index"
              @regenerate="handleRegenerateResponse"
              @copy="handleCopyMessage"
              @translate="handleTranslateMessage" />

            <!-- AI正在输入 -->
            <div class="typing-indicator" v-if="isTyping">
              <div class="typing-content">
                <el-avatar :size="32" class="typing-avatar">
                  <Robot />
                </el-avatar>
                <div class="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-container">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="3"
            :maxlength="2000"
            show-word-limit
            placeholder="输入您的问题或命令..."
            @keydown="handleKeyDown"
            :disabled="!canSendMessage || isTyping"
            class="message-input" />
          
          <div class="input-actions">
            <div class="input-tools">
              <el-tooltip content="命令模式">
                <el-button 
                  text 
                  :icon="Terminal" 
                  :class="{ active: commandMode }"
                  @click="commandMode = !commandMode" />
              </el-tooltip>
              <el-tooltip content="语音输入">
                <el-button 
                  text 
                  :icon="Microphone" 
                  @click="startVoiceInput"
                  :disabled="isRecording" />
              </el-tooltip>
              <el-tooltip content="上传文件">
                <el-button 
                  text 
                  :icon="Paperclip" 
                  @click="handleFileUpload" />
              </el-tooltip>
            </div>
            
            <div class="send-actions">
              <el-button 
                :icon="ChatDotRound" 
                :disabled="!canSend"
                :loading="isTyping"
                @click="sendMessage">
                {{ commandMode ? '翻译命令' : '发送' }}
              </el-button>
            </div>
          </div>
        </div>
        
        <!-- 命令模式提示 -->
        <div class="command-mode-hint" v-if="commandMode">
          <el-alert
            title="命令模式"
            description="在此模式下，您的输入将被翻译为对应的终端命令"
            type="info"
            :closable="false"
            show-icon />
        </div>
      </div>
    </div>

    <!-- AI配置对话框 -->
    <ai-config-dialog
      v-model="showConfigDialog"
      :config="aiConfig"
      :available-models="availableModels"
      @save="handleSaveConfig" />

    <!-- 命令翻译对话框 -->
    <command-translate-dialog
      v-model="showTranslateDialog"
      :text="translateText"
      @execute="handleExecuteCommand" />

    <!-- 使用统计对话框 -->
    <usage-stats-dialog
      v-model="showStatsDialog"
      :stats="usageStats" />
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Refresh,
  Delete,
  Setting,
  MoreFilled,
  Download,
  MagicStick,
  DataAnalysis,
  Robot,
  Terminal,
  Microphone,
  Paperclip,
  ChatDotRound,
  Expand,
  Fold
} from '@element-plus/icons-vue'
import MessageItem from '@/components/AIChat/MessageItem.vue'
import AIConfigDialog from '@/components/AIChat/AIConfigDialog.vue'
import CommandTranslateDialog from '@/components/AIChat/CommandTranslateDialog.vue'
import UsageStatsDialog from '@/components/AIChat/UsageStatsDialog.vue'

export default {
  name: 'AIChat',
  components: {
    MessageItem,
    AIConfigDialog,
    CommandTranslateDialog,
    UsageStatsDialog
  },
  setup() {
    const store = useStore()
    
    // 响应式数据
    const messageListRef = ref()
    const scrollbarRef = ref()
    const inputMessage = ref('')
    const commandMode = ref(false)
    const isRecording = ref(false)
    const sidebarCollapsed = ref(false)
    const showConfigDialog = ref(false)
    const showTranslateDialog = ref(false)
    const showStatsDialog = ref(false)
    const translateText = ref('')
    
    // 计算属性
    const conversations = computed(() => store.state.ai.conversations)
    const currentConversation = computed(() => store.state.ai.currentConversation)
    const messages = computed(() => store.state.ai.messages)
    const isTyping = computed(() => store.state.ai.isTyping)
    const availableModels = computed(() => store.state.ai.availableModels)
    const aiConfig = computed(() => store.state.ai.aiConfig)
    const usageStats = computed(() => store.state.ai.usageStats)
    const canSendMessage = computed(() => store.getters['ai/canSendMessage'])
    
    const canSend = computed(() => {
      return inputMessage.value.trim() && canSendMessage.value && !isTyping.value
    })
    
    // 方法
    const toggleSidebar = () => {
      sidebarCollapsed.value = !sidebarCollapsed.value
    }
    
    const fetchConversations = async () => {
      try {
        await store.dispatch('ai/fetchConversations')
      } catch (error) {
        ElMessage.error('获取对话列表失败: ' + error.message)
      }
    }
    
    const createNewConversation = async () => {
      try {
        await store.dispatch('ai/createConversation')
        ElMessage.success('新对话已创建')
      } catch (error) {
        ElMessage.error('创建对话失败: ' + error.message)
      }
    }
    
    const loadConversation = async (conversationId) => {
      try {
        await store.dispatch('ai/loadConversation', conversationId)
        scrollToBottom()
      } catch (error) {
        ElMessage.error('加载对话失败: ' + error.message)
      }
    }
    
    const deleteConversation = async (conversationId) => {
      try {
        await ElMessageBox.confirm('确定要删除这个对话吗？', '确认删除', {
          type: 'warning'
        })
        
        await store.dispatch('ai/deleteConversation', conversationId)
        ElMessage.success('对话已删除')
      } catch (error) {
        if (error === 'cancel') return
        ElMessage.error('删除对话失败: ' + error.message)
      }
    }
    
    const sendMessage = async () => {
      if (!canSend.value) return
      
      const message = inputMessage.value.trim()
      inputMessage.value = ''
      
      try {
        if (commandMode.value) {
          // 命令翻译模式
          const result = await store.dispatch('ai/translateCommand', {
            text: message,
            model: aiConfig.value.model,
            provider: aiConfig.value.provider
          })
          
          if (result.success) {
            ElMessage.success('命令翻译成功')
            translateText.value = result.data.command
            showTranslateDialog.value = true
          } else {
            ElMessage.error('命令翻译失败: ' + result.message)
          }
        } else {
          // 普通对话模式
          await store.dispatch('ai/sendMessage', {
            message,
            model: aiConfig.value.model,
            provider: aiConfig.value.provider
          })
          
          scrollToBottom()
        }
      } catch (error) {
        ElMessage.error('发送消息失败: ' + error.message)
      }
    }
    
    const sendQuickMessage = (message) => {
      inputMessage.value = message
      sendMessage()
    }
    
    const clearMessages = async () => {
      try {
        await ElMessageBox.confirm('确定要清空当前对话吗？', '确认清空', {
          type: 'warning'
        })
        
        store.dispatch('ai/clearMessages')
        ElMessage.success('对话已清空')
      } catch (error) {
        // 用户取消
      }
    }
    
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        sendMessage()
      }
    }
    
    const handleDropdownCommand = (command) => {
      switch (command) {
        case 'export':
          exportConversation()
          break
        case 'translate':
          commandMode.value = true
          break
        case 'stats':
          showStatsDialog.value = true
          break
      }
    }
    
    const exportConversation = () => {
      if (messages.value.length === 0) {
        ElMessage.warning('当前对话为空，无法导出')
        return
      }
      
      try {
        const exportData = {
          title: currentConversation.value?.title || 'AI对话',
          messages: messages.value,
          exportTime: new Date().toISOString()
        }
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        })
        
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ai_chat_${Date.now()}.json`
        a.click()
        
        URL.revokeObjectURL(url)
        ElMessage.success('对话已导出')
      } catch (error) {
        ElMessage.error('导出失败: ' + error.message)
      }
    }
    
    const handleRegenerateResponse = async (messageIndex) => {
      try {
        await store.dispatch('ai/regenerateResponse', messageIndex)
        ElMessage.success('回复已重新生成')
      } catch (error) {
        ElMessage.error('重新生成失败: ' + error.message)
      }
    }
    
    const handleCopyMessage = (message) => {
      try {
        navigator.clipboard.writeText(message.content)
        ElMessage.success('消息已复制到剪贴板')
      } catch (error) {
        ElMessage.error('复制失败')
      }
    }
    
    const handleTranslateMessage = async (message) => {
      try {
        const result = await store.dispatch('ai/translateCommand', {
          text: message.content
        })
        
        if (result.success) {
          translateText.value = result.data.command
          showTranslateDialog.value = true
        }
      } catch (error) {
        ElMessage.error('翻译失败: ' + error.message)
      }
    }
    
    const handleSaveConfig = async (config) => {
      try {
        await store.dispatch('ai/updateConfig', config)
        ElMessage.success('配置已保存')
      } catch (error) {
        ElMessage.error('保存配置失败: ' + error.message)
      }
    }
    
    const handleExecuteCommand = (command) => {
      // 这里可以集成到终端执行
      ElMessage.info('命令执行功能开发中...')
    }
    
    const startVoiceInput = () => {
      ElMessage.info('语音输入功能开发中...')
    }
    
    const handleFileUpload = () => {
      ElMessage.info('文件上传功能开发中...')
    }
    
    const scrollToBottom = () => {
      nextTick(() => {
        if (scrollbarRef.value) {
          scrollbarRef.value.setScrollTop(scrollbarRef.value.wrapRef.scrollHeight)
        }
      })
    }
    
    const formatRelativeTime = (dateTime) => {
      if (!dateTime) return ''
      
      const now = new Date()
      const time = new Date(dateTime)
      const diff = now - time
      
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)
      
      if (minutes < 1) return '刚刚'
      if (minutes < 60) return `${minutes}分钟前`
      if (hours < 24) return `${hours}小时前`
      if (days < 7) return `${days}天前`
      
      return time.toLocaleDateString('zh-CN')
    }
    
    // 生命周期
    onMounted(async () => {
      // 加载AI配置
      await store.dispatch('ai/loadAIConfig')
      
      // 获取对话列表
      await fetchConversations()
      
      // 获取可用模型
      await store.dispatch('ai/fetchAvailableModels')
      
      // 获取使用统计
      await store.dispatch('ai/fetchUsageStats')
      
      // 如果没有当前对话，创建一个新的
      if (!currentConversation.value && conversations.value.length === 0) {
        await createNewConversation()
      }
    })
    
    // 监听消息变化，自动滚动到底部
    watch(messages, () => {
      scrollToBottom()
    }, { deep: true })
    
    return {
      // 图标
      Plus,
      Refresh,
      Delete,
      Setting,
      MoreFilled,
      Download,
      MagicStick,
      DataAnalysis,
      Robot,
      Terminal,
      Microphone,
      Paperclip,
      ChatDotRound,
      Expand,
      Fold,
      
      // 响应式数据
      messageListRef,
      scrollbarRef,
      inputMessage,
      commandMode,
      isRecording,
      sidebarCollapsed,
      showConfigDialog,
      showTranslateDialog,
      showStatsDialog,
      translateText,
      
      // 计算属性
      conversations,
      currentConversation,
      messages,
      isTyping,
      availableModels,
      aiConfig,
      usageStats,
      canSendMessage,
      canSend,
      
      // 方法
      toggleSidebar,
      fetchConversations,
      createNewConversation,
      loadConversation,
      deleteConversation,
      sendMessage,
      sendQuickMessage,
      clearMessages,
      handleKeyDown,
      handleDropdownCommand,
      handleRegenerateResponse,
      handleCopyMessage,
      handleTranslateMessage,
      handleSaveConfig,
      handleExecuteCommand,
      startVoiceInput,
      handleFileUpload,
      formatRelativeTime
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-chat-container {
  height: 100vh;
  display: flex;
  background: var(--el-bg-color-page);
}

.sidebar {
  width: 280px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  
  &.collapsed {
    width: 60px;
  }
  
  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--el-border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    h3 {
      margin: 0;
      font-size: 16px;
      color: var(--el-text-color-primary);
    }
  }
  
  .sidebar-content {
    flex: 1;
    padding: 16px;
    overflow: hidden;
  }
  
  .new-chat-btn {
    width: 100%;
    margin-bottom: 16px;
  }
  
  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    span {
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-regular);
    }
  }
  
  .conversation-item {
    padding: 12px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 4px;
    position: relative;
    transition: background-color 0.2s ease;
    
    &:hover {
      background: var(--el-fill-color-light);
      
      .delete-btn {
        opacity: 1;
      }
    }
    
    &.active {
      background: var(--el-color-primary-light-9);
      border-left: 3px solid var(--el-color-primary);
    }
    
    .conv-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .conv-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
    
    .delete-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
  }
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .chat-title {
    display: flex;
    align-items: center;
    gap: 12px;
    
    h3 {
      margin: 0;
      font-size: 18px;
      color: var(--el-text-color-primary);
    }
  }
  
  .chat-actions {
    display: flex;
    gap: 8px;
  }
}

.message-list {
  flex: 1;
  overflow: hidden;
}

.messages-container {
  padding: 16px 24px;
  min-height: 100%;
}

.welcome-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 400px;
  
  .welcome-content {
    text-align: center;
    max-width: 500px;
    
    .welcome-icon {
      font-size: 64px;
      color: var(--el-color-primary);
      margin-bottom: 16px;
    }
    
    h2 {
      margin: 0 0 8px 0;
      color: var(--el-text-color-primary);
    }
    
    p {
      color: var(--el-text-color-regular);
      margin-bottom: 24px;
      line-height: 1.6;
    }
    
    .quick-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}

.typing-indicator {
  padding: 16px 0;
  
  .typing-content {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .typing-avatar {
      background: var(--el-color-primary-light-3);
      color: var(--el-color-primary);
    }
    
    .typing-dots {
      display: flex;
      gap: 4px;
      
      span {
        width: 8px;
        height: 8px;
        background: var(--el-color-primary);
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out;
        
        &:nth-child(1) { animation-delay: -0.32s; }
        &:nth-child(2) { animation-delay: -0.16s; }
      }
    }
  }
}

@keyframes typing {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.input-area {
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
  
  .input-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .message-input {
    resize: none;
  }
  
  .input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .input-tools {
    display: flex;
    gap: 8px;
    
    .el-button.active {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }
  }
  
  .command-mode-hint {
    margin-top: 12px;
  }
}

:deep(.el-scrollbar__view) {
  height: 100%;
}
</style>