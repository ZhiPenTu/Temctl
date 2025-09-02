<template>
  <div class="file-transfer-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button 
          type="primary" 
          :icon="Upload" 
          :disabled="!canUpload"
          @click="handleUpload">
          上传
        </el-button>
        <el-button 
          type="success" 
          :icon="Download" 
          :disabled="!canDownload"
          @click="handleDownload">
          下载
        </el-button>
        <el-button 
          :icon="Refresh" 
          @click="refreshDirectories">
          刷新
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-button 
          :icon="Setting" 
          @click="showSettings = true">
          设置
        </el-button>
        <el-button 
          :icon="List" 
          @click="showTransferHistory = true">
          传输记录
        </el-button>
      </div>
    </div>

    <!-- 主界面 -->
    <div class="main-content">
      <!-- 文件浏览器 -->
      <div class="file-browsers">
        <!-- 本地文件浏览器 -->
        <div class="file-browser local">
          <div class="browser-header">
            <h3>
              <el-icon><Folder /></el-icon>
              本地文件
            </h3>
            <div class="path-bar">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item 
                  v-for="(segment, index) in localPathSegments" 
                  :key="index"
                  @click="navigateToPath('local', index)">
                  {{ segment }}
                </el-breadcrumb-item>
              </el-breadcrumb>
            </div>
          </div>
          <file-browser
            type="local"
            :contents="directoryContents.local"
            :selected-files="selectedFiles.local"
            :current-path="currentDirectory.local"
            @navigate="handleNavigate"
            @select="handleFileSelect"
            @double-click="handleFileDoubleClick" />
        </div>

        <!-- 远程文件浏览器 -->
        <div class="file-browser remote">
          <div class="browser-header">
            <h3>
              <el-icon><Monitor /></el-icon>
              远程文件 - {{ currentHost?.name || '未连接' }}
            </h3>
            <div class="path-bar" v-if="currentHost">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item 
                  v-for="(segment, index) in remotePathSegments" 
                  :key="index"
                  @click="navigateToPath('remote', index)">
                  {{ segment }}
                </el-breadcrumb-item>
              </el-breadcrumb>
            </div>
          </div>
          <div v-if="!currentHost" class="no-connection">
            <el-empty description="请先连接到主机">
              <el-button type="primary" @click="$router.push('/hosts')">
                选择主机
              </el-button>
            </el-empty>
          </div>
          <file-browser
            v-else
            type="remote"
            :contents="directoryContents.remote"
            :selected-files="selectedFiles.remote"
            :current-path="currentDirectory.remote"
            @navigate="handleNavigate"
            @select="handleFileSelect"
            @double-click="handleFileDoubleClick" />
        </div>
      </div>

      <!-- 传输进度面板 -->
      <div class="transfer-panel" v-if="activeTransfers.length > 0">
        <div class="panel-header">
          <h4>
            <el-icon><Clock /></el-icon>
            传输进度 ({{ activeTransfersCount }})
          </h4>
          <el-button 
            size="small" 
            text 
            @click="showTransferPanel = !showTransferPanel">
            {{ showTransferPanel ? '隐藏' : '显示' }}
          </el-button>
        </div>
        <div v-show="showTransferPanel" class="panel-content">
          <transfer-item
            v-for="transfer in activeTransfers"
            :key="transfer.id"
            :transfer="transfer"
            @pause="handlePauseTransfer"
            @resume="handleResumeTransfer"
            @cancel="handleCancelTransfer" />
        </div>
      </div>
    </div>

    <!-- 传输设置对话框 -->
    <transfer-settings-dialog
      v-model="showSettings"
      :settings="transferSettings"
      @save="handleSaveSettings" />

    <!-- 传输历史对话框 -->
    <transfer-history-dialog
      v-model="showTransferHistory"
      :history="transferHistory" />

    <!-- 传输确认对话框 -->
    <transfer-confirm-dialog
      v-model="showTransferConfirm"
      :transfer-info="transferInfo"
      @confirm="handleConfirmTransfer" />
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Upload, 
  Download, 
  Refresh, 
  Setting, 
  List, 
  Folder, 
  Monitor, 
  Clock 
} from '@element-plus/icons-vue'
import FileBrowser from '@/components/FileTransfer/FileBrowser.vue'
import TransferItem from '@/components/FileTransfer/TransferItem.vue'
import TransferSettingsDialog from '@/components/FileTransfer/TransferSettingsDialog.vue'
import TransferHistoryDialog from '@/components/FileTransfer/TransferHistoryDialog.vue'
import TransferConfirmDialog from '@/components/FileTransfer/TransferConfirmDialog.vue'

export default {
  name: 'FileTransfer',
  components: {
    FileBrowser,
    TransferItem,
    TransferSettingsDialog,
    TransferHistoryDialog,
    TransferConfirmDialog
  },
  setup() {
    const store = useStore()
    
    // 响应式数据
    const showSettings = ref(false)
    const showTransferHistory = ref(false)
    const showTransferConfirm = ref(false)
    const showTransferPanel = ref(true)
    const transferInfo = ref(null)
    
    // 计算属性
    const currentHost = computed(() => store.getters['connections/currentHost'])
    const activeTransfers = computed(() => store.state.fileTransfer.activeTransfers)
    const transferHistory = computed(() => store.state.fileTransfer.transferHistory)
    const currentDirectory = computed(() => store.state.fileTransfer.currentDirectory)
    const directoryContents = computed(() => store.state.fileTransfer.directoryContents)
    const selectedFiles = computed(() => store.state.fileTransfer.selectedFiles)
    const transferSettings = computed(() => store.state.fileTransfer.transferSettings)
    const activeTransfersCount = computed(() => store.getters['fileTransfer/activeTransfersCount'])
    
    const localPathSegments = computed(() => {
      return currentDirectory.value.local.split('/').filter(s => s)
    })
    
    const remotePathSegments = computed(() => {
      return currentDirectory.value.remote.split('/').filter(s => s)
    })
    
    const canUpload = computed(() => {
      return currentHost.value && selectedFiles.value.local.length > 0
    })
    
    const canDownload = computed(() => {
      return currentHost.value && selectedFiles.value.remote.length > 0
    })
    
    // 方法
    const refreshDirectories = async () => {
      try {
        // 刷新本地目录
        await store.dispatch('fileTransfer/fetchDirectoryContents', {
          type: 'local',
          path: currentDirectory.value.local
        })
        
        // 刷新远程目录
        if (currentHost.value) {
          await store.dispatch('fileTransfer/fetchDirectoryContents', {
            type: 'remote',
            path: currentDirectory.value.remote,
            hostId: currentHost.value.id
          })
        }
        
        ElMessage.success('目录已刷新')
      } catch (error) {
        ElMessage.error('刷新目录失败: ' + error.message)
      }
    }
    
    const handleNavigate = async (type, path) => {
      try {
        const payload = { type, path }
        if (type === 'remote' && currentHost.value) {
          payload.hostId = currentHost.value.id
        }
        
        await store.dispatch('fileTransfer/fetchDirectoryContents', payload)
      } catch (error) {
        ElMessage.error('导航失败: ' + error.message)
      }
    }
    
    const navigateToPath = async (type, segmentIndex) => {
      const segments = type === 'local' ? localPathSegments.value : remotePathSegments.value
      const path = '/' + segments.slice(0, segmentIndex + 1).join('/')
      await handleNavigate(type, path)
    }
    
    const handleFileSelect = (type, files) => {
      store.dispatch('fileTransfer/selectFiles', { type, files })
    }
    
    const handleFileDoubleClick = (type, file) => {
      if (file.type === 'directory') {
        const newPath = currentDirectory.value[type] + '/' + file.name
        handleNavigate(type, newPath)
      }
    }
    
    const handleUpload = () => {
      if (!canUpload.value) return
      
      const localFiles = selectedFiles.value.local
      const remotePath = currentDirectory.value.remote
      
      transferInfo.value = {
        type: 'upload',
        files: localFiles,
        sourcePath: currentDirectory.value.local,
        targetPath: remotePath,
        hostId: currentHost.value.id
      }
      
      showTransferConfirm.value = true
    }
    
    const handleDownload = () => {
      if (!canDownload.value) return
      
      const remoteFiles = selectedFiles.value.remote
      const localPath = currentDirectory.value.local
      
      transferInfo.value = {
        type: 'download',
        files: remoteFiles,
        sourcePath: currentDirectory.value.remote,
        targetPath: localPath,
        hostId: currentHost.value.id
      }
      
      showTransferConfirm.value = true
    }
    
    const handleConfirmTransfer = async (transferData) => {
      try {
        if (transferData.type === 'upload') {
          // 批量上传
          const transfers = transferData.files.map(file => ({
            type: 'upload',
            localPath: `${transferData.sourcePath}/${file.name}`,
            remotePath: `${transferData.targetPath}/${file.name}`
          }))
          
          await store.dispatch('fileTransfer/batchTransfer', {
            hostId: transferData.hostId,
            transfers,
            options: {
              checksum: transferSettings.value.verifyChecksum
            }
          })
        } else {
          // 批量下载
          const transfers = transferData.files.map(file => ({
            type: 'download',
            remotePath: `${transferData.sourcePath}/${file.name}`,
            localPath: `${transferData.targetPath}/${file.name}`
          }))
          
          await store.dispatch('fileTransfer/batchTransfer', {
            hostId: transferData.hostId,
            transfers,
            options: {
              checksum: transferSettings.value.verifyChecksum
            }
          })
        }
        
        // 清除选择
        store.dispatch('fileTransfer/clearFileSelection', 'local')
        store.dispatch('fileTransfer/clearFileSelection', 'remote')
        
        ElMessage.success('传输已开始')
      } catch (error) {
        ElMessage.error('开始传输失败: ' + error.message)
      }
    }
    
    const handlePauseTransfer = async (transferId) => {
      try {
        await store.dispatch('fileTransfer/pauseTransfer', transferId)
        ElMessage.success('传输已暂停')
      } catch (error) {
        ElMessage.error('暂停传输失败: ' + error.message)
      }
    }
    
    const handleResumeTransfer = async (transferId) => {
      try {
        await store.dispatch('fileTransfer/resumeTransfer', transferId)
        ElMessage.success('传输已恢复')
      } catch (error) {
        ElMessage.error('恢复传输失败: ' + error.message)
      }
    }
    
    const handleCancelTransfer = async (transferId) => {
      try {
        await ElMessageBox.confirm('确定要取消此传输吗？', '确认取消', {
          type: 'warning'
        })
        
        await store.dispatch('fileTransfer/cancelTransfer', transferId)
        ElMessage.success('传输已取消')
      } catch (error) {
        if (error === 'cancel') return
        ElMessage.error('取消传输失败: ' + error.message)
      }
    }
    
    const handleSaveSettings = async (settings) => {
      try {
        await store.dispatch('fileTransfer/updateTransferSettings', settings)
        ElMessage.success('设置已保存')
      } catch (error) {
        ElMessage.error('保存设置失败: ' + error.message)
      }
    }
    
    // 生命周期
    onMounted(async () => {
      // 加载传输设置
      await store.dispatch('fileTransfer/loadTransferSettings')
      
      // 获取活动传输
      await store.dispatch('fileTransfer/fetchActiveTransfers')
      
      // 初始化本地目录
      await handleNavigate('local', currentDirectory.value.local)
      
      // 如果有当前主机，初始化远程目录
      if (currentHost.value) {
        await handleNavigate('remote', currentDirectory.value.remote)
      }
    })
    
    // 监听当前主机变化
    watch(currentHost, async (newHost) => {
      if (newHost) {
        await handleNavigate('remote', '/')
      }
    })
    
    return {
      // 图标
      Upload,
      Download,
      Refresh,
      Setting,
      List,
      Folder,
      Monitor,
      Clock,
      
      // 响应式数据
      showSettings,
      showTransferHistory,
      showTransferConfirm,
      showTransferPanel,
      transferInfo,
      
      // 计算属性
      currentHost,
      activeTransfers,
      transferHistory,
      currentDirectory,
      directoryContents,
      selectedFiles,
      transferSettings,
      activeTransfersCount,
      localPathSegments,
      remotePathSegments,
      canUpload,
      canDownload,
      
      // 方法
      refreshDirectories,
      handleNavigate,
      navigateToPath,
      handleFileSelect,
      handleFileDoubleClick,
      handleUpload,
      handleDownload,
      handleConfirmTransfer,
      handlePauseTransfer,
      handleResumeTransfer,
      handleCancelTransfer,
      handleSaveSettings
    }
  }
}
</script>

<style lang="scss" scoped>
.file-transfer-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  
  .toolbar-left,
  .toolbar-right {
    display: flex;
    gap: 8px;
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-browsers {
  display: flex;
  flex: 1;
  gap: 1px;
  background: var(--el-border-color);
}

.file-browser {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  
  &.local {
    border-right: 1px solid var(--el-border-color);
  }
}

.browser-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  
  h3 {
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: var(--el-text-color-primary);
  }
  
  .path-bar {
    .el-breadcrumb {
      font-size: 12px;
    }
    
    :deep(.el-breadcrumb__item) {
      cursor: pointer;
      
      &:hover {
        color: var(--el-color-primary);
      }
    }
  }
}

.no-connection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transfer-panel {
  border-top: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color);
    
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }
  }
  
  .panel-content {
    max-height: 300px;
    overflow-y: auto;
    padding: 8px;
  }
}
</style>