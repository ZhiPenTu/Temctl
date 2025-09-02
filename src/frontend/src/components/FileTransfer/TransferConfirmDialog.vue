<template>
  <el-dialog
    v-model="dialogVisible"
    title="确认传输"
    width="500px"
    @close="handleClose">
    <div class="confirm-content">
      <div class="transfer-summary">
        <h4>传输信息</h4>
        <div class="summary-item">
          <span class="label">传输类型:</span>
          <el-tag :type="transferInfo?.type === 'upload' ? 'primary' : 'success'">
            {{ transferInfo?.type === 'upload' ? '上传' : '下载' }}
          </el-tag>
        </div>
        <div class="summary-item">
          <span class="label">文件数量:</span>
          <span>{{ transferInfo?.files?.length || 0 }} 个</span>
        </div>
        <div class="summary-item">
          <span class="label">总大小:</span>
          <span>{{ formatTotalSize() }}</span>
        </div>
        <div class="summary-item">
          <span class="label">{{ transferInfo?.type === 'upload' ? '目标' : '源' }}路径:</span>
          <code>{{ transferInfo?.sourcePath }}</code>
        </div>
        <div class="summary-item">
          <span class="label">{{ transferInfo?.type === 'upload' ? '源' : '目标' }}路径:</span>
          <code>{{ transferInfo?.targetPath }}</code>
        </div>
      </div>
      
      <div class="file-list" v-if="transferInfo?.files?.length">
        <h4>文件列表</h4>
        <el-scrollbar height="200px">
          <div class="file-item" v-for="file in transferInfo.files" :key="file.name">
            <el-icon>
              <Document v-if="file.type === 'file'" />
              <Folder v-else />
            </el-icon>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
        </el-scrollbar>
      </div>
      
      <div class="transfer-options">
        <el-checkbox v-model="options.verifyChecksum">
          传输后验证文件完整性
        </el-checkbox>
        <el-checkbox v-model="options.overwrite">
          覆盖已存在的文件
        </el-checkbox>
        <el-checkbox v-model="options.createPath" v-if="transferInfo?.type === 'upload'">
          自动创建目标目录
        </el-checkbox>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :loading="confirming">
        开始传输
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ref, computed } from 'vue'
import { Document, Folder } from '@element-plus/icons-vue'

export default {
  name: 'TransferConfirmDialog',
  components: {
    Document,
    Folder
  },
  props: {
    modelValue: Boolean,
    transferInfo: Object
  },
  emits: ['update:modelValue', 'confirm'],
  setup(props, { emit }) {
    const confirming = ref(false)
    const options = ref({
      verifyChecksum: true,
      overwrite: false,
      createPath: true
    })
    
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    const formatTotalSize = () => {
      if (!props.transferInfo?.files) return '0 B'
      
      const totalSize = props.transferInfo.files.reduce((sum, file) => {
        return sum + (file.size || 0)
      }, 0)
      
      return formatFileSize(totalSize)
    }
    
    const formatFileSize = (size) => {
      if (!size || size === 0) return '0 B'
      
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let fileSize = size
      let unitIndex = 0
      
      while (fileSize >= 1024 && unitIndex < units.length - 1) {
        fileSize /= 1024
        unitIndex++
      }
      
      return `${fileSize.toFixed(1)} ${units[unitIndex]}`
    }
    
    const handleConfirm = () => {
      confirming.value = true
      
      const transferData = {
        ...props.transferInfo,
        options: { ...options.value }
      }
      
      emit('confirm', transferData)
      
      setTimeout(() => {
        confirming.value = false
        dialogVisible.value = false
      }, 500)
    }
    
    const handleClose = () => {
      dialogVisible.value = false
    }
    
    return {
      confirming,
      options,
      dialogVisible,
      formatTotalSize,
      formatFileSize,
      handleConfirm,
      handleClose
    }
  }
}
</script>

<style lang="scss" scoped>
.confirm-content {
  .transfer-summary,
  .file-list,
  .transfer-options {
    margin-bottom: 20px;
  }
  
  h4 {
    margin: 0 0 12px 0;
    color: var(--el-text-color-primary);
  }
  
  .summary-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    
    .label {
      width: 80px;
      color: var(--el-text-color-regular);
    }
    
    code {
      background: var(--el-fill-color-light);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
    }
  }
  
  .file-item {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    margin-bottom: 2px;
    border-radius: 4px;
    
    &:hover {
      background: var(--el-fill-color-light);
    }
    
    .file-name {
      flex: 1;
      margin-left: 8px;
      margin-right: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .file-size {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
  
  .transfer-options {
    border-top: 1px solid var(--el-border-color-lighter);
    padding-top: 16px;
    
    .el-checkbox {
      display: block;
      margin-bottom: 8px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>