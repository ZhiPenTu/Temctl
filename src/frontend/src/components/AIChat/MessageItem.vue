<template>
  <div class="message-item" :class="[`role-${message.role}`, { 'has-actions': showActions }]">
    <div class="message-avatar">
      <el-avatar :size="36" v-if="message.role === 'user'">
        <User />
      </el-avatar>
      <el-avatar :size="36" v-else class="ai-avatar">
        <Robot />
      </el-avatar>
    </div>
    
    <div class="message-content">
      <div class="message-header" v-if="message.role === 'assistant'">
        <span class="message-sender">AI助手</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        <div class="message-actions" v-if="showActions">
          <el-tooltip content="重新生成">
            <el-button 
              text 
              size="small" 
              :icon="Refresh" 
              @click="$emit('regenerate', index)" />
          </el-tooltip>
          <el-tooltip content="复制">
            <el-button 
              text 
              size="small" 
              :icon="DocumentCopy" 
              @click="$emit('copy', message)" />
          </el-tooltip>
          <el-tooltip content="翻译为命令">
            <el-button 
              text 
              size="small" 
              :icon="MagicStick" 
              @click="$emit('translate', message)" />
          </el-tooltip>
        </div>
      </div>
      
      <div class="message-body">
        <div class="message-text" v-if="!isCodeBlock">
          <div v-html="renderMarkdown(message.content)"></div>
        </div>
        
        <div class="code-block" v-else>
          <div class="code-header">
            <span class="code-language">{{ codeLanguage }}</span>
            <el-button 
              text 
              size="small" 
              :icon="DocumentCopy"
              @click="copyCode">
              复制代码
            </el-button>
          </div>
          <pre><code v-html="highlightedCode"></code></pre>
        </div>
      </div>
      
      <div class="message-footer" v-if="message.usage">
        <div class="usage-info">
          <el-tag size="small" type="info">
            {{ message.usage.totalTokens }} tokens
          </el-tag>
          <span class="response-time" v-if="message.responseTime">
            {{ message.responseTime }}ms
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  User,
  Robot,
  Refresh,
  DocumentCopy,
  MagicStick
} from '@element-plus/icons-vue'
// 这里可以引入markdown渲染库，如marked
// import { marked } from 'marked'

export default {
  name: 'MessageItem',
  props: {
    message: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  },
  emits: ['regenerate', 'copy', 'translate'],
  setup(props) {
    // 计算属性
    const showActions = computed(() => {
      return props.message.role === 'assistant'
    })
    
    const isCodeBlock = computed(() => {
      return props.message.content.includes('```')
    })
    
    const codeLanguage = computed(() => {
      const match = props.message.content.match(/```(\w+)/)
      return match ? match[1] : 'text'
    })
    
    const highlightedCode = computed(() => {
      // 简单的代码提取，实际项目中可以使用highlight.js
      const codeMatch = props.message.content.match(/```\w*\n([\s\S]*?)```/)
      return codeMatch ? codeMatch[1] : props.message.content
    })
    
    // 方法
    const formatTime = (timestamp) => {
      if (!timestamp) return ''
      
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const renderMarkdown = (content) => {
      // 简单的markdown渲染，实际项目中建议使用专业库
      if (!content) return ''
      
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')
    }
    
    const copyCode = () => {
      try {
        navigator.clipboard.writeText(highlightedCode.value)
        ElMessage.success('代码已复制')
      } catch (error) {
        ElMessage.error('复制失败')
      }
    }
    
    return {
      // 图标
      User,
      Robot,
      Refresh,
      DocumentCopy,
      MagicStick,
      
      // 计算属性
      showActions,
      isCodeBlock,
      codeLanguage,
      highlightedCode,
      
      // 方法
      formatTime,
      renderMarkdown,
      copyCode
    }
  }
}
</script>

<style lang="scss" scoped>
.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  padding: 12px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: var(--el-fill-color-lighter);
    
    &.has-actions .message-actions {
      opacity: 1;
    }
  }
  
  &.role-user {
    flex-direction: row-reverse;
    
    .message-content {
      background: var(--el-color-primary-light-9);
      border: 1px solid var(--el-color-primary-light-7);
    }
  }
  
  &.role-assistant {
    .ai-avatar {
      background: var(--el-color-success-light-3);
      color: var(--el-color-success);
    }
  }
}

.message-avatar {
  flex-shrink: 0;
  
  .el-avatar {
    border: 2px solid var(--el-border-color-lighter);
  }
}

.message-content {
  flex: 1;
  min-width: 0;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  
  .message-sender {
    font-weight: 500;
    color: var(--el-text-color-primary);
    font-size: 14px;
  }
  
  .message-time {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
  
  .message-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
}

.message-body {
  .message-text {
    line-height: 1.6;
    color: var(--el-text-color-primary);
    
    :deep(strong) {
      font-weight: 600;
    }
    
    :deep(em) {
      font-style: italic;
    }
    
    :deep(code) {
      background: var(--el-fill-color-light);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
    }
  }
  
  .code-block {
    background: var(--el-fill-color-dark);
    border-radius: 6px;
    overflow: hidden;
    
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--el-fill-color-darker);
      border-bottom: 1px solid var(--el-border-color);
      
      .code-language {
        font-size: 12px;
        color: var(--el-text-color-regular);
        font-weight: 500;
      }
    }
    
    pre {
      margin: 0;
      padding: 12px;
      overflow-x: auto;
      
      code {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        line-height: 1.4;
        color: var(--el-text-color-primary);
      }
    }
  }
}

.message-footer {
  margin-top: 8px;
  
  .usage-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .response-time {
      font-size: 11px;
      color: var(--el-text-color-placeholder);
    }
  }
}

.role-user .message-content {
  .message-text {
    text-align: left;
  }
}
</style>