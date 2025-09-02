<template>
  <div class="transfer-item" :class="[`status-${transfer.status}`, { 'has-error': hasError }]">
    <div class="transfer-header">
      <div class="transfer-info">
        <div class="transfer-icon">
          <el-icon v-if="transfer.type === 'upload'" class="upload-icon">
            <Upload />
          </el-icon>
          <el-icon v-else class="download-icon">
            <Download />
          </el-icon>
        </div>
        <div class="transfer-details">
          <div class="transfer-title">
            {{ transfer.fileName }}
          </div>
          <div class="transfer-subtitle">
            {{ getTransferDescription() }}
          </div>
        </div>
      </div>
      <div class="transfer-actions">
        <el-button-group v-if="showActions">
          <el-tooltip content="暂停" v-if="canPause">
            <el-button size="small" :icon="VideoPause" @click="handlePause" />
          </el-tooltip>
          <el-tooltip content="恢复" v-if="canResume">
            <el-button size="small" :icon="VideoPlay" @click="handleResume" />
          </el-tooltip>
          <el-tooltip content="取消" v-if="canCancel">
            <el-button size="small" :icon="Close" @click="handleCancel" />
          </el-tooltip>
        </el-button-group>
        <el-tag 
          :type="getStatusTagType()" 
          size="small"
          effect="plain">
          {{ getStatusText() }}
        </el-tag>
      </div>
    </div>
    
    <div class="transfer-progress" v-if="showProgress">
      <el-progress
        :percentage="progressPercentage"
        :status="getProgressStatus()"
        :stroke-width="6"
        :show-text="false" />
      <div class="progress-details">
        <div class="progress-text">
          <span>{{ formatBytes(transferredSize) }} / {{ formatBytes(totalSize) }}</span>
          <span v-if="transfer.status === 'transferring'">
            ({{ formatSpeed(currentSpeed) }})
          </span>
        </div>
        <div class="progress-percentage">
          {{ progressPercentage }}%
        </div>
      </div>
    </div>
    
    <div class="transfer-error" v-if="hasError">
      <el-alert
        :title="transfer.errorMessage || '传输失败'"
        type="error"
        :closable="false"
        show-icon />
    </div>
    
    <div class="transfer-meta" v-if="showMeta">
      <div class="meta-item">
        <span class="meta-label">开始时间:</span>
        <span class="meta-value">{{ formatDateTime(transfer.startedAt) }}</span>
      </div>
      <div class="meta-item" v-if="transfer.completedAt">
        <span class="meta-label">完成时间:</span>
        <span class="meta-value">{{ formatDateTime(transfer.completedAt) }}</span>
      </div>
      <div class="meta-item" v-if="transfer.completedAt">
        <span class="meta-label">耗时:</span>
        <span class="meta-value">{{ formatDuration() }}</span>
      </div>
      <div class="meta-item" v-if="transfer.checksum">
        <span class="meta-label">校验和:</span>
        <span class="meta-value checksum">{{ transfer.checksum.substring(0, 16) }}...</span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import {
  Upload,
  Download,
  VideoPause,
  VideoPlay,
  Close
} from '@element-plus/icons-vue'

export default {
  name: 'TransferItem',
  props: {
    transfer: {
      type: Object,
      required: true
    },
    compact: {
      type: Boolean,
      default: false
    }
  },
  emits: ['pause', 'resume', 'cancel'],
  setup(props, { emit }) {
    // 计算属性
    const transferredSize = computed(() => {
      return props.transfer.transferredSize || 0
    })
    
    const totalSize = computed(() => {
      return props.transfer.fileSize || props.transfer.totalSize || 0
    })
    
    const currentSpeed = computed(() => {
      return props.transfer.transferSpeed || 0
    })
    
    const progressPercentage = computed(() => {
      if (totalSize.value === 0) return 0
      return Math.min(100, Math.round((transferredSize.value / totalSize.value) * 100))
    })
    
    const hasError = computed(() => {
      return props.transfer.status === 'failed' || props.transfer.status === 'error'
    })
    
    const showProgress = computed(() => {
      return ['transferring', 'paused', 'completed'].includes(props.transfer.status)
    })
    
    const showActions = computed(() => {
      return ['transferring', 'paused', 'pending'].includes(props.transfer.status)
    })
    
    const showMeta = computed(() => {
      return !props.compact && props.transfer.startedAt
    })
    
    const canPause = computed(() => {
      return props.transfer.status === 'transferring'
    })
    
    const canResume = computed(() => {
      return props.transfer.status === 'paused'
    })
    
    const canCancel = computed(() => {
      return ['transferring', 'paused', 'pending'].includes(props.transfer.status)
    })
    
    // 方法
    const getTransferDescription = () => {
      const type = props.transfer.type === 'upload' ? '上传到' : '下载到'
      const path = props.transfer.type === 'upload' 
        ? props.transfer.remotePath 
        : props.transfer.localPath
      
      // 只显示文件名部分
      const pathParts = path.split('/')
      return `${type} ${pathParts[pathParts.length - 1] || '/'}`
    }
    
    const getStatusText = () => {
      const statusMap = {
        'pending': '等待中',
        'transferring': '传输中',
        'paused': '已暂停',
        'completed': '已完成',
        'failed': '失败',
        'cancelled': '已取消'
      }
      return statusMap[props.transfer.status] || '未知状态'
    }
    
    const getStatusTagType = () => {
      const typeMap = {
        'pending': 'info',
        'transferring': 'primary',
        'paused': 'warning',
        'completed': 'success',
        'failed': 'danger',
        'cancelled': 'info'
      }
      return typeMap[props.transfer.status] || 'info'
    }
    
    const getProgressStatus = () => {
      if (hasError.value) return 'exception'
      if (props.transfer.status === 'completed') return 'success'
      return null
    }
    
    const formatBytes = (bytes) => {
      if (!bytes || bytes === 0) return '0 B'
      
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let index = 0
      let size = bytes
      
      while (size >= 1024 && index < units.length - 1) {
        size /= 1024
        index++
      }
      
      return `${size.toFixed(1)} ${units[index]}`
    }
    
    const formatSpeed = (bytesPerSecond) => {
      return `${formatBytes(bytesPerSecond)}/s`
    }
    
    const formatDateTime = (dateTime) => {
      if (!dateTime) return '--'
      
      try {
        const date = new Date(dateTime)
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      } catch {
        return '--'
      }
    }
    
    const formatDuration = () => {
      if (!props.transfer.startedAt || !props.transfer.completedAt) {
        return '--'
      }
      
      try {
        const start = new Date(props.transfer.startedAt)
        const end = new Date(props.transfer.completedAt)
        const duration = Math.floor((end - start) / 1000) // 秒
        
        const hours = Math.floor(duration / 3600)
        const minutes = Math.floor((duration % 3600) / 60)
        const seconds = duration % 60
        
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        } else {
          return `${minutes}:${seconds.toString().padStart(2, '0')}`
        }
      } catch {
        return '--'
      }
    }
    
    const handlePause = () => {
      emit('pause', props.transfer.id)
    }
    
    const handleResume = () => {
      emit('resume', props.transfer.id)
    }
    
    const handleCancel = () => {
      emit('cancel', props.transfer.id)
    }
    
    return {
      // 图标
      Upload,
      Download,
      VideoPause,
      VideoPlay,
      Close,
      
      // 计算属性
      transferredSize,
      totalSize,
      currentSpeed,
      progressPercentage,
      hasError,
      showProgress,
      showActions,
      showMeta,
      canPause,
      canResume,
      canCancel,
      
      // 方法
      getTransferDescription,
      getStatusText,
      getStatusTagType,
      getProgressStatus,
      formatBytes,
      formatSpeed,
      formatDateTime,
      formatDuration,
      handlePause,
      handleResume,
      handleCancel
    }
  }
}
</script>

<style lang="scss" scoped>
.transfer-item {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--el-bg-color);
  transition: all 0.3s ease;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &.status-transferring {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.1);
  }
  
  &.status-completed {
    border-color: var(--el-color-success);
  }
  
  &.has-error {
    border-color: var(--el-color-danger);
  }
}

.transfer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.transfer-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.transfer-icon {
  margin-right: 12px;
  
  .upload-icon {
    color: var(--el-color-primary);
  }
  
  .download-icon {
    color: var(--el-color-success);
  }
}

.transfer-details {
  flex: 1;
  min-width: 0;
}

.transfer-title {
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transfer-subtitle {
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transfer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transfer-progress {
  margin-bottom: 8px;
  
  .progress-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }
  
  .progress-text {
    display: flex;
    gap: 8px;
  }
  
  .progress-percentage {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
}

.transfer-error {
  margin-bottom: 8px;
  
  :deep(.el-alert) {
    padding: 8px 12px;
    
    .el-alert__content {
      .el-alert__title {
        font-size: 12px;
        line-height: 1.4;
      }
    }
  }
}

.transfer-meta {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 8px;
  
  .meta-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .meta-label {
    font-weight: 500;
  }
  
  .meta-value {
    &.checksum {
      font-family: 'Consolas', 'Monaco', monospace;
    }
  }
}

:deep(.el-progress) {
  .el-progress__text {
    display: none;
  }
}
</style>