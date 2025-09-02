<template>
  <el-dialog
    v-model="dialogVisible"
    title="命令翻译"
    width="600px"
    @close="handleClose">
    <div class="translate-content">
      <div class="translate-result">
        <h4>翻译结果</h4>
        <div class="command-display">
          <pre><code>{{ text }}</code></pre>
          <el-button 
            text 
            :icon="DocumentCopy" 
            @click="copyCommand">
            复制
          </el-button>
        </div>
      </div>
      
      <div class="command-actions">
        <el-alert
          title="安全提醒"
          description="请仔细检查命令内容，确认无误后再执行"
          type="warning"
          :closable="false"
          show-icon />
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" @click="executeCommand">
        执行命令
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy } from '@element-plus/icons-vue'

export default {
  name: 'CommandTranslateDialog',
  props: {
    modelValue: Boolean,
    text: String
  },
  emits: ['update:modelValue', 'execute'],
  setup(props, { emit }) {
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    const copyCommand = () => {
      try {
        navigator.clipboard.writeText(props.text)
        ElMessage.success('命令已复制')
      } catch (error) {
        ElMessage.error('复制失败')
      }
    }
    
    const executeCommand = () => {
      emit('execute', props.text)
      dialogVisible.value = false
    }
    
    const handleClose = () => {
      dialogVisible.value = false
    }
    
    return {
      DocumentCopy,
      dialogVisible,
      copyCommand,
      executeCommand,
      handleClose
    }
  }
}
</script>

<style lang="scss" scoped>
.command-display {
  position: relative;
  background: var(--el-fill-color-dark);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
  
  pre {
    margin: 0;
    color: var(--el-text-color-primary);
    font-family: 'Consolas', 'Monaco', monospace;
  }
  
  .el-button {
    position: absolute;
    top: 8px;
    right: 8px;
  }
}

h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}
</style>