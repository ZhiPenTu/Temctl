<template>
  <el-dialog
    v-model="dialogVisible"
    title="传输记录"
    width="800px"
    @close="handleClose">
    <div class="history-content">
      <div class="history-toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索文件名..."
          style="width: 200px"
          clearable />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable>
          <el-option label="全部" value="" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
      </div>
      
      <el-table :data="filteredHistory" height="400">
        <el-table-column label="文件名" prop="fileName" min-width="200" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'upload' ? 'primary' : 'success'" size="small">
              {{ row.type === 'upload' ? '上传' : '下载' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">
            {{ formatBytes(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column label="传输时间" width="150">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'TransferHistoryDialog',
  props: {
    modelValue: Boolean,
    history: Array
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const searchQuery = ref('')
    const statusFilter = ref('')
    
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    const filteredHistory = computed(() => {
      let filtered = props.history || []
      
      if (searchQuery.value) {
        filtered = filtered.filter(item => 
          item.fileName.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      if (statusFilter.value) {
        filtered = filtered.filter(item => item.status === statusFilter.value)
      }
      
      return filtered
    })
    
    const getStatusType = (status) => {
      const map = {
        completed: 'success',
        failed: 'danger',
        cancelled: 'info'
      }
      return map[status] || 'info'
    }
    
    const getStatusText = (status) => {
      const map = {
        completed: '完成',
        failed: '失败',
        cancelled: '取消'
      }
      return map[status] || status
    }
    
    const formatBytes = (bytes) => {
      if (!bytes) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unitIndex = 0
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      return `${size.toFixed(1)} ${units[unitIndex]}`
    }
    
    const formatDateTime = (dateTime) => {
      if (!dateTime) return '--'
      return new Date(dateTime).toLocaleString('zh-CN')
    }
    
    const handleClose = () => {
      dialogVisible.value = false
    }
    
    return {
      searchQuery,
      statusFilter,
      dialogVisible,
      filteredHistory,
      getStatusType,
      getStatusText,
      formatBytes,
      formatDateTime,
      handleClose
    }
  }
}
</script>

<style lang="scss" scoped>
.history-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
</style>