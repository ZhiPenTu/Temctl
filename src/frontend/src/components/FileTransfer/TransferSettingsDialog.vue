<template>
  <el-dialog
    v-model="dialogVisible"
    title="传输设置"
    width="500px"
    @close="handleClose">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px">
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="传输参数" name="transfer">
          <el-form-item label="块大小" prop="chunkSize">
            <el-select v-model="formData.chunkSize" style="width: 100%">
              <el-option label="32 KB" :value="32768" />
              <el-option label="64 KB" :value="65536" />
              <el-option label="128 KB" :value="131072" />
              <el-option label="256 KB" :value="262144" />
              <el-option label="512 KB" :value="524288" />
              <el-option label="1 MB" :value="1048576" />
            </el-select>
            <div class="form-help">
              传输时的数据块大小，较大的块可能提高传输速度
            </div>
          </el-form-item>
          
          <el-form-item label="最大并发数" prop="maxConcurrent">
            <el-input-number
              v-model="formData.maxConcurrent"
              :min="1"
              :max="10"
              style="width: 100%" />
            <div class="form-help">
              同时进行的最大传输任务数量
            </div>
          </el-form-item>
          
          <el-form-item label="自动重试" prop="autoRetry">
            <el-switch v-model="formData.autoRetry" />
            <div class="form-help">
              传输失败时是否自动重试
            </div>
          </el-form-item>
          
          <el-form-item 
            label="重试次数" 
            prop="retryCount"
            v-if="formData.autoRetry">
            <el-input-number
              v-model="formData.retryCount"
              :min="1"
              :max="10"
              style="width: 100%" />
            <div class="form-help">
              自动重试的最大次数
            </div>
          </el-form-item>
          
          <el-form-item label="校验文件" prop="verifyChecksum">
            <el-switch v-model="formData.verifyChecksum" />
            <div class="form-help">
              传输完成后验证文件完整性
            </div>
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="界面设置" name="interface">
          <el-form-item label="显示隐藏文件" prop="showHiddenFiles">
            <el-switch v-model="formData.showHiddenFiles" />
            <div class="form-help">
              在文件浏览器中显示以点开头的隐藏文件
            </div>
          </el-form-item>
          
          <el-form-item label="自动刷新" prop="autoRefresh">
            <el-switch v-model="formData.autoRefresh" />
            <div class="form-help">
              文件传输完成后自动刷新目录列表
            </div>
          </el-form-item>
          
          <el-form-item label="确认删除" prop="confirmDelete">
            <el-switch v-model="formData.confirmDelete" />
            <div class="form-help">
              删除文件前显示确认对话框
            </div>
          </el-form-item>
          
          <el-form-item label="显示传输速度" prop="showTransferSpeed">
            <el-switch v-model="formData.showTransferSpeed" />
            <div class="form-help">
              在传输过程中显示实时传输速度
            </div>
          </el-form-item>
          
          <el-form-item label="传输完成通知" prop="notifyOnComplete">
            <el-switch v-model="formData.notifyOnComplete" />
            <div class="form-help">
              传输完成时显示系统通知
            </div>
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="高级选项" name="advanced">
          <el-form-item label="连接超时" prop="connectionTimeout">
            <el-input-number
              v-model="formData.connectionTimeout"
              :min="5"
              :max="300"
              style="width: 100%" />
            <div class="form-help">
              建立连接的超时时间（秒）
            </div>
          </el-form-item>
          
          <el-form-item label="传输超时" prop="transferTimeout">
            <el-input-number
              v-model="formData.transferTimeout"
              :min="30"
              :max="3600"
              style="width: 100%" />
            <div class="form-help">
              单个文件传输的超时时间（秒）
            </div>
          </el-form-item>
          
          <el-form-item label="保持连接" prop="keepAlive">
            <el-switch v-model="formData.keepAlive" />
            <div class="form-help">
              在传输间隙保持连接活跃
            </div>
          </el-form-item>
          
          <el-form-item label="压缩传输" prop="compression">
            <el-switch v-model="formData.compression" />
            <div class="form-help">
              启用传输压缩以减少带宽使用
            </div>
          </el-form-item>
          
          <el-form-item label="断点续传" prop="resumeSupport">
            <el-switch v-model="formData.resumeSupport" />
            <div class="form-help">
              支持中断后从断点继续传输
            </div>
          </el-form-item>
        </el-tab-pane>
      </el-tabs>
    </el-form>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleReset">恢复默认</el-button>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

export default {
  name: 'TransferSettingsDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    // 响应式数据
    const formRef = ref()
    const activeTab = ref('transfer')
    const saving = ref(false)
    
    const defaultSettings = {
      chunkSize: 65536,
      maxConcurrent: 5,
      autoRetry: true,
      retryCount: 3,
      verifyChecksum: true,
      showHiddenFiles: false,
      autoRefresh: true,
      confirmDelete: true,
      showTransferSpeed: true,
      notifyOnComplete: true,
      connectionTimeout: 30,
      transferTimeout: 300,
      keepAlive: true,
      compression: false,
      resumeSupport: true
    }
    
    const formData = ref({ ...defaultSettings, ...props.settings })
    
    // 计算属性
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    // 表单验证规则
    const rules = {
      chunkSize: [
        { required: true, message: '请选择块大小', trigger: 'change' }
      ],
      maxConcurrent: [
        { required: true, message: '请设置最大并发数', trigger: 'blur' },
        { type: 'number', min: 1, max: 10, message: '并发数应在1-10之间', trigger: 'blur' }
      ],
      retryCount: [
        { required: true, message: '请设置重试次数', trigger: 'blur' },
        { type: 'number', min: 1, max: 10, message: '重试次数应在1-10之间', trigger: 'blur' }
      ],
      connectionTimeout: [
        { required: true, message: '请设置连接超时时间', trigger: 'blur' },
        { type: 'number', min: 5, max: 300, message: '连接超时应在5-300秒之间', trigger: 'blur' }
      ],
      transferTimeout: [
        { required: true, message: '请设置传输超时时间', trigger: 'blur' },
        { type: 'number', min: 30, max: 3600, message: '传输超时应在30-3600秒之间', trigger: 'blur' }
      ]
    }
    
    // 方法
    const handleSave = async () => {
      try {
        await formRef.value.validate()
        saving.value = true
        
        // 触发保存事件
        emit('save', { ...formData.value })
        
        ElMessage.success('设置已保存')
        dialogVisible.value = false
      } catch (error) {
        ElMessage.error('请检查设置项是否正确')
      } finally {
        saving.value = false
      }
    }
    
    const handleClose = () => {
      // 重置表单数据
      formData.value = { ...defaultSettings, ...props.settings }
      dialogVisible.value = false
    }
    
    const handleReset = async () => {
      try {
        await ElMessageBox.confirm('确定要恢复到默认设置吗？', '确认重置', {
          type: 'warning'
        })
        
        formData.value = { ...defaultSettings }
        ElMessage.success('已恢复默认设置')
      } catch (error) {
        // 用户取消
      }
    }
    
    // 监听设置变化
    watch(() => props.settings, (newSettings) => {
      if (newSettings) {
        formData.value = { ...defaultSettings, ...newSettings }
      }
    }, { deep: true })
    
    return {
      // 响应式数据
      formRef,
      activeTab,
      saving,
      formData,
      rules,
      
      // 计算属性
      dialogVisible,
      
      // 方法
      handleSave,
      handleClose,
      handleReset
    }
  }
}
</script>

<style lang="scss" scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-help {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
  line-height: 1.4;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
  
  .el-form-item__label {
    font-weight: 500;
  }
}

:deep(.el-tabs) {
  .el-tabs__header {
    margin-bottom: 20px;
  }
  
  .el-tabs__content {
    overflow: visible;
  }
}

:deep(.el-input-number) {
  width: 100%;
}
</style>