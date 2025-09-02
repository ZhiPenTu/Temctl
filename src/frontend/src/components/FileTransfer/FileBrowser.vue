<template>
  <div class="file-browser-content">
    <div class="browser-toolbar">
      <div class="toolbar-left">
        <el-button 
          size="small" 
          :icon="ArrowUp" 
          @click="handleGoUp"
          :disabled="isRoot">
          上级目录
        </el-button>
        <el-button 
          size="small" 
          :icon="FolderAdd" 
          @click="handleCreateFolder"
          v-if="type === 'local'">
          新建文件夹
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchQuery"
          size="small"
          placeholder="搜索文件..."
          :prefix-icon="Search"
          clearable
          style="width: 200px" />
      </div>
    </div>
    
    <div class="file-list-container">
      <el-table
        ref="fileTableRef"
        :data="filteredContents"
        :show-header="true"
        :highlight-current-row="true"
        @selection-change="handleSelectionChange"
        @row-dblclick="handleRowDoubleClick"
        height="100%">
        
        <el-table-column type="selection" width="50" />
        
        <el-table-column label="名称" prop="name" min-width="200">
          <template #default="{ row }">
            <div class="file-item">
              <el-icon class="file-icon" :class="getFileTypeClass(row)">
                <component :is="getFileIcon(row)" />
              </el-icon>
              <span class="file-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="大小" prop="size" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.type === 'file'">{{ formatFileSize(row.size) }}</span>
            <span v-else class="text-muted">--</span>
          </template>
        </el-table-column>
        
        <el-table-column label="修改时间" prop="modified" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.modified) }}
          </template>
        </el-table-column>
        
        <el-table-column label="权限" prop="permissions" width="120" v-if="type === 'remote'">
          <template #default="{ row }">
            <code class="permissions">{{ row.permissions }}</code>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button 
                size="small" 
                text 
                :icon="Download" 
                @click="handleDownloadFile(row)"
                v-if="type === 'remote' && row.type === 'file'">
              </el-button>
              <el-button 
                size="small" 
                text 
                :icon="Upload" 
                @click="handleUploadFile(row)"
                v-if="type === 'local' && row.type === 'file'">
              </el-button>
              <el-button 
                size="small" 
                text 
                :icon="Delete" 
                @click="handleDeleteFile(row)"
                v-if="canDelete">
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <!-- 右键菜单 -->
    <el-dropdown
      ref="contextMenuRef"
      trigger="contextmenu"
      @command="handleContextMenu">
      <div></div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="open" :icon="FolderOpened">
            打开
          </el-dropdown-item>
          <el-dropdown-item command="download" :icon="Download" v-if="type === 'remote'">
            下载
          </el-dropdown-item>
          <el-dropdown-item command="upload" :icon="Upload" v-if="type === 'local'">
            上传
          </el-dropdown-item>
          <el-dropdown-item divided command="rename" :icon="Edit">
            重命名
          </el-dropdown-item>
          <el-dropdown-item command="delete" :icon="Delete">
            删除
          </el-dropdown-item>
          <el-dropdown-item divided command="properties" :icon="InfoFilled">
            属性
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    
    <!-- 新建文件夹对话框 -->
    <el-dialog
      v-model="showCreateFolderDialog"
      title="新建文件夹"
      width="400px">
      <el-form @submit.prevent="handleConfirmCreateFolder">
        <el-form-item label="文件夹名称">
          <el-input
            v-model="newFolderName"
            placeholder="请输入文件夹名称"
            @keyup.enter="handleConfirmCreateFolder" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateFolderDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmCreateFolder">确定</el-button>
      </template>
    </el-dialog>
    
    <!-- 文件属性对话框 -->
    <file-properties-dialog
      v-model="showPropertiesDialog"
      :file="selectedFileForProperties" />
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowUp,
  FolderAdd,
  Search,
  Download,
  Upload,
  Delete,
  FolderOpened,
  Edit,
  InfoFilled,
  Folder,
  Document,
  Picture,
  VideoCamera,
  Headphones,
  Files
} from '@element-plus/icons-vue'
import FilePropertiesDialog from './FilePropertiesDialog.vue'

export default {
  name: 'FileBrowser',
  components: {
    FilePropertiesDialog
  },
  props: {
    type: {
      type: String,
      required: true,
      validator: value => ['local', 'remote'].includes(value)
    },
    contents: {
      type: Array,
      default: () => []
    },
    selectedFiles: {
      type: Array,
      default: () => []
    },
    currentPath: {
      type: String,
      default: '/'
    }
  },
  emits: ['navigate', 'select', 'double-click'],
  setup(props, { emit }) {
    // 响应式数据
    const fileTableRef = ref()
    const contextMenuRef = ref()
    const searchQuery = ref('')
    const showCreateFolderDialog = ref(false)
    const showPropertiesDialog = ref(false)
    const newFolderName = ref('')
    const selectedFileForProperties = ref(null)
    
    // 计算属性
    const isRoot = computed(() => {
      return props.currentPath === '/' || props.currentPath === ''
    })
    
    const canDelete = computed(() => {
      // 本地文件可以删除，远程文件需要权限检查
      return props.type === 'local' || true // 暂时允许删除远程文件
    })
    
    const filteredContents = computed(() => {
      if (!searchQuery.value) {
        return props.contents
      }
      
      const query = searchQuery.value.toLowerCase()
      return props.contents.filter(item => 
        item.name.toLowerCase().includes(query)
      )
    })
    
    // 方法
    const getFileIcon = (file) => {
      if (file.type === 'directory') {
        return Folder
      }
      
      const ext = getFileExtension(file.name).toLowerCase()
      
      // 图片文件
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
        return Picture
      }
      
      // 视频文件
      if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
        return VideoCamera
      }
      
      // 音频文件
      if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext)) {
        return Headphones
      }
      
      // 文档文件
      if (['txt', 'doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return Document
      }
      
      // 压缩文件
      if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
        return Files
      }
      
      return Document
    }
    
    const getFileTypeClass = (file) => {
      if (file.type === 'directory') {
        return 'folder-icon'
      }
      
      const ext = getFileExtension(file.name).toLowerCase()
      
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
        return 'image-icon'
      }
      
      if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
        return 'video-icon'
      }
      
      if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext)) {
        return 'audio-icon'
      }
      
      return 'file-icon'
    }
    
    const getFileExtension = (filename) => {
      return filename.split('.').pop() || ''
    }
    
    const formatFileSize = (size) => {
      if (!size || size === 0) return '0 B'
      
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let index = 0
      let fileSize = size
      
      while (fileSize >= 1024 && index < units.length - 1) {
        fileSize /= 1024
        index++
      }
      
      return `${fileSize.toFixed(1)} ${units[index]}`
    }
    
    const formatDateTime = (dateTime) => {
      if (!dateTime) return '--'
      
      try {
        const date = new Date(dateTime)
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch {
        return dateTime
      }
    }
    
    const handleGoUp = () => {
      if (isRoot.value) return
      
      const pathParts = props.currentPath.split('/').filter(p => p)
      pathParts.pop()
      const parentPath = '/' + pathParts.join('/')
      
      emit('navigate', props.type, parentPath)
    }
    
    const handleCreateFolder = () => {
      newFolderName.value = ''
      showCreateFolderDialog.value = true
    }
    
    const handleConfirmCreateFolder = async () => {
      if (!newFolderName.value.trim()) {
        ElMessage.warning('请输入文件夹名称')
        return
      }
      
      try {
        // 这里需要调用创建文件夹的API
        if (props.type === 'local') {
          const { ipcRenderer } = window.require('electron')
          const folderPath = `${props.currentPath}/${newFolderName.value}`
          await ipcRenderer.invoke('create-directory', folderPath)
        }
        
        showCreateFolderDialog.value = false
        ElMessage.success('文件夹创建成功')
        
        // 刷新目录
        emit('navigate', props.type, props.currentPath)
      } catch (error) {
        ElMessage.error('创建文件夹失败: ' + error.message)
      }
    }
    
    const handleSelectionChange = (selection) => {
      emit('select', props.type, selection)
    }
    
    const handleRowDoubleClick = (row) => {
      emit('double-click', props.type, row)
    }
    
    const handleDownloadFile = (file) => {
      // 触发单个文件下载
      emit('select', props.type, [file])
      // 这里可以直接触发下载逻辑
    }
    
    const handleUploadFile = (file) => {
      // 触发单个文件上传
      emit('select', props.type, [file])
      // 这里可以直接触发上传逻辑
    }
    
    const handleDeleteFile = async (file) => {
      try {
        await ElMessageBox.confirm(
          `确定要删除 "${file.name}" 吗？此操作不可恢复。`,
          '确认删除',
          {
            type: 'warning'
          }
        )
        
        // 这里需要调用删除文件的API
        if (props.type === 'local') {
          const { ipcRenderer } = window.require('electron')
          const filePath = `${props.currentPath}/${file.name}`
          await ipcRenderer.invoke('delete-file', filePath)
        }
        
        ElMessage.success('删除成功')
        
        // 刷新目录
        emit('navigate', props.type, props.currentPath)
      } catch (error) {
        if (error === 'cancel') return
        ElMessage.error('删除失败: ' + error.message)
      }
    }
    
    const handleContextMenu = (command, file) => {
      switch (command) {
        case 'open':
          if (file.type === 'directory') {
            emit('double-click', props.type, file)
          }
          break
        case 'download':
          handleDownloadFile(file)
          break
        case 'upload':
          handleUploadFile(file)
          break
        case 'rename':
          // 实现重命名逻辑
          break
        case 'delete':
          handleDeleteFile(file)
          break
        case 'properties':
          selectedFileForProperties.value = file
          showPropertiesDialog.value = true
          break
      }
    }
    
    // 监听选中文件变化，更新表格选择
    watch(() => props.selectedFiles, (newSelection) => {
      nextTick(() => {
        if (fileTableRef.value) {
          fileTableRef.value.clearSelection()
          newSelection.forEach(file => {
            const row = props.contents.find(item => item.name === file.name)
            if (row) {
              fileTableRef.value.toggleRowSelection(row, true)
            }
          })
        }
      })
    }, { immediate: true })
    
    return {
      // 图标
      ArrowUp,
      FolderAdd,
      Search,
      Download,
      Upload,
      Delete,
      FolderOpened,
      Edit,
      InfoFilled,
      
      // 响应式数据
      fileTableRef,
      contextMenuRef,
      searchQuery,
      showCreateFolderDialog,
      showPropertiesDialog,
      newFolderName,
      selectedFileForProperties,
      
      // 计算属性
      isRoot,
      canDelete,
      filteredContents,
      
      // 方法
      getFileIcon,
      getFileTypeClass,
      formatFileSize,
      formatDateTime,
      handleGoUp,
      handleCreateFolder,
      handleConfirmCreateFolder,
      handleSelectionChange,
      handleRowDoubleClick,
      handleDownloadFile,
      handleUploadFile,
      handleDeleteFile,
      handleContextMenu
    }
  }
}
</script>

<style lang="scss" scoped>
.file-browser-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.browser-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  
  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.file-list-container {
  flex: 1;
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .file-icon {
    font-size: 16px;
    
    &.folder-icon {
      color: var(--el-color-warning);
    }
    
    &.image-icon {
      color: var(--el-color-success);
    }
    
    &.video-icon {
      color: var(--el-color-danger);
    }
    
    &.audio-icon {
      color: var(--el-color-info);
    }
    
    &.file-icon {
      color: var(--el-text-color-regular);
    }
  }
  
  .file-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.permissions {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  padding: 2px 4px;
  border-radius: 3px;
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

:deep(.el-table) {
  .el-table__row {
    cursor: pointer;
    
    &:hover {
      background-color: var(--el-table-row-hover-bg-color);
    }
  }
}
</style>