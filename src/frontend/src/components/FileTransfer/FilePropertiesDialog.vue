<template>
  <el-dialog
    v-model="dialogVisible"
    title="文件属性"
    width="400px"
    @close="handleClose">
    <div class="properties-content" v-if="file">
      <div class="property-item">
        <span class="label">名称:</span>
        <span class="value">{{ file.name }}</span>
      </div>
      <div class="property-item">
        <span class="label">类型:</span>
        <span class="value">{{ file.type === 'directory' ? '文件夹' : '文件' }}</span>
      </div>
      <div class="property-item" v-if="file.type === 'file'">
        <span class="label">大小:</span>
        <span class="value">{{ formatFileSize(file.size) }}</span>
      </div>
      <div class="property-item" v-if="file.permissions">
        <span class="label">权限:</span>
        <code class="value">{{ file.permissions }}</code>
      </div>
      <div class="property-item" v-if="file.modified">
        <span class="label">修改时间:</span>
        <span class="value">{{ formatDateTime(file.modified) }}</span>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'FilePropertiesDialog',
  props: {
    modelValue: Boolean,
    file: Object
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    const formatFileSize = (size) => {
      if (!size || size === 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let fileSize = size
      let unitIndex = 0
      while (fileSize >= 1024 && unitIndex < units.length - 1) {
        fileSize /= 1024
        unitIndex++
      }
      return `${fileSize.toFixed(1)} ${units[unitIndex]}`
    }
    
    const formatDateTime = (dateTime) => {
      if (!dateTime) return '--'
      try {
        return new Date(dateTime).toLocaleString('zh-CN')
      } catch {
        return dateTime
      }
    }
    
    const handleClose = () => {
      dialogVisible.value = false
    }
    
    return {
      dialogVisible,
      formatFileSize,
      formatDateTime,
      handleClose
    }
  }
}
</script>

<style lang="scss" scoped>
.property-item {
  display: flex;
  margin-bottom: 12px;
  
  .label {
    width: 80px;
    color: var(--el-text-color-regular);
  }
  
  .value {
    flex: 1;
    word-break: break-all;
  }
  
  code {
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
  }
}
</style>