<template>
  <el-dialog
    v-model="dialogVisible"
    title="AI配置"
    width="600px"
    @close="handleClose">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px">
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本设置" name="basic">
          <el-form-item label="服务提供商" prop="provider">
            <el-select v-model="formData.provider" style="width: 100%" @change="handleProviderChange">
              <el-option label="OpenAI" value="openai" />
              <el-option label="本地模型" value="local" />
              <el-option label="Claude" value="claude" />
              <el-option label="Gemini" value="gemini" />
            </el-select>
          </el-form-item>
          
          <el-form-item 
            label="API密钥" 
            prop="apiKey"
            v-if="formData.provider !== 'local'">
            <el-input
              v-model="formData.apiKey"
              type="password"
              placeholder="请输入API密钥"
              show-password />
            <div class="form-help">
              API密钥将被加密存储在本地
            </div>
          </el-form-item>
          
          <el-form-item 
            label="服务端点" 
            prop="endpoint"
            v-if="formData.provider === 'local'">
            <el-input
              v-model="formData.endpoint"
              placeholder="http://localhost:11434" />
            <div class="form-help">
              本地模型服务的访问地址
            </div>
          </el-form-item>
          
          <el-form-item label="模型" prop="model">
            <el-select 
              v-model="formData.model" 
              style="width: 100%"
              filterable
              allow-create>
              <el-option
                v-for="model in filteredModels"
                :key="model.name"
                :label="model.displayName || model.name"
                :value="model.name" />
            </el-select>
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="高级参数" name="advanced">
          <el-form-item label="温度" prop="temperature">
            <el-slider
              v-model="formData.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              show-input
              :input-size="'small'"
              style="width: 100%" />
            <div class="form-help">
              控制回复的随机性，0-2之间，值越高越随机
            </div>
          </el-form-item>
          
          <el-form-item label="最大令牌数" prop="maxTokens">
            <el-input-number
              v-model="formData.maxTokens"
              :min="1"
              :max="4000"
              :step="100"
              style="width: 100%" />
            <div class="form-help">
              单次回复的最大令牌数量
            </div>
          </el-form-item>
          
          <el-form-item label="系统提示词" prop="systemPrompt">
            <el-input
              v-model="formData.systemPrompt"
              type="textarea"
              :rows="4"
              placeholder="您是一个有用的AI助手..." />
            <div class="form-help">
              定制AI助手的行为和角色
            </div>
          </el-form-item>
          
          <el-form-item label="启用上下文" prop="enableContext">
            <el-switch v-model="formData.enableContext" />
            <div class="form-help">
              是否在对话中保持上下文记忆
            </div>
          </el-form-item>
          
          <el-form-item label="上下文长度" prop="contextLength" v-if="formData.enableContext">
            <el-input-number
              v-model="formData.contextLength"
              :min="1"
              :max="50"
              style="width: 100%" />
            <div class="form-help">
              保留的历史消息条数
            </div>
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="连接测试" name="test">
          <div class="test-section">
            <div class="test-info">
              <el-alert
                title="连接测试"
                description="测试当前配置是否能够正常连接到AI服务"
                type="info"
                :closable="false"
                show-icon />
            </div>
            
            <div class="test-controls">
              <el-button 
                type="primary" 
                :loading="testing"
                @click="testConnection">
                测试连接
              </el-button>
              <el-button 
                :disabled="!testPassed"
                @click="testChat">
                测试对话
              </el-button>
            </div>
            
            <div class="test-result" v-if="testResult">
              <el-result
                :icon="testResult.success ? 'success' : 'error'"
                :title="testResult.success ? '连接成功' : '连接失败'"
                :sub-title="testResult.message">
                <template #extra v-if="testResult.success && testResult.data">
                  <div class="connection-info">
                    <div class="info-item">
                      <span>模型:</span>
                      <span>{{ testResult.data.model }}</span>
                    </div>
                    <div class="info-item" v-if="testResult.data.version">
                      <span>版本:</span>
                      <span>{{ testResult.data.version }}</span>
                    </div>
                    <div class="info-item" v-if="testResult.data.latency">
                      <span>延迟:</span>
                      <span>{{ testResult.data.latency }}ms</span>
                    </div>
                  </div>
                </template>
              </el-result>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-form>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'AIConfigDialog',
  props: {
    modelValue: Boolean,
    config: Object,
    availableModels: Array
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    // 响应式数据
    const formRef = ref()
    const activeTab = ref('basic')
    const saving = ref(false)
    const testing = ref(false)
    const testResult = ref(null)
    const testPassed = ref(false)
    
    const defaultConfig = {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      endpoint: '',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: '',
      enableContext: true,
      contextLength: 10
    }
    
    const formData = ref({ ...defaultConfig, ...props.config })
    
    // 计算属性
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    const filteredModels = computed(() => {
      if (!props.availableModels) return []
      return props.availableModels.filter(model => 
        model.provider === formData.value.provider
      )
    })
    
    // 表单验证规则
    const rules = {
      provider: [
        { required: true, message: '请选择服务提供商', trigger: 'change' }
      ],
      apiKey: [
        { 
          required: true, 
          message: '请输入API密钥', 
          trigger: 'blur',
          validator: (rule, value, callback) => {
            if (formData.value.provider !== 'local' && !value) {
              callback(new Error('请输入API密钥'))
            } else {
              callback()
            }
          }
        }
      ],
      model: [
        { required: true, message: '请选择或输入模型名称', trigger: 'blur' }
      ],
      endpoint: [
        {
          validator: (rule, value, callback) => {
            if (formData.value.provider === 'local' && !value) {
              callback(new Error('请输入服务端点'))
            } else {
              callback()
            }
          },
          trigger: 'blur'
        }
      ],
      temperature: [
        { required: true, message: '请设置温度参数', trigger: 'blur' },
        { type: 'number', min: 0, max: 2, message: '温度应在0-2之间', trigger: 'blur' }
      ],
      maxTokens: [
        { required: true, message: '请设置最大令牌数', trigger: 'blur' },
        { type: 'number', min: 1, max: 4000, message: '令牌数应在1-4000之间', trigger: 'blur' }
      ]
    }
    
    // 方法
    const handleProviderChange = () => {
      // 切换提供商时重置相关配置
      testResult.value = null
      testPassed.value = false
      
      // 根据提供商设置默认模型
      const defaultModels = {
        openai: 'gpt-3.5-turbo',
        local: 'llama2',
        claude: 'claude-3-sonnet',
        gemini: 'gemini-pro'
      }
      
      formData.value.model = defaultModels[formData.value.provider] || ''
    }
    
    const testConnection = async () => {
      try {
        testing.value = true
        testResult.value = null
        
        // 验证必填字段
        if (formData.value.provider !== 'local' && !formData.value.apiKey) {
          throw new Error('请先填写API密钥')
        }
        
        if (formData.value.provider === 'local' && !formData.value.endpoint) {
          throw new Error('请先填写服务端点')
        }
        
        // 调用后端测试接口
        const response = await this.$api.post('/ai/test-connection', {
          provider: formData.value.provider,
          config: {
            apiKey: formData.value.apiKey,
            endpoint: formData.value.endpoint,
            model: formData.value.model
          }
        })
        
        testResult.value = response.data
        testPassed.value = response.data.success
        
        if (response.data.success) {
          ElMessage.success('连接测试成功')
        } else {
          ElMessage.error('连接测试失败: ' + response.data.message)
        }
      } catch (error) {
        testResult.value = {
          success: false,
          message: error.message
        }
        testPassed.value = false
        ElMessage.error('连接测试失败: ' + error.message)
      } finally {
        testing.value = false
      }
    }
    
    const testChat = async () => {
      try {
        const response = await this.$api.post('/ai/chat', {
          message: '你好，这是一个连接测试',
          model: formData.value.model,
          provider: formData.value.provider
        })
        
        if (response.data.success) {
          ElMessage.success('对话测试成功')
        } else {
          ElMessage.error('对话测试失败')
        }
      } catch (error) {
        ElMessage.error('对话测试失败: ' + error.message)
      }
    }
    
    const handleSave = async () => {
      try {
        await formRef.value.validate()
        saving.value = true
        
        emit('save', { ...formData.value })
        
        ElMessage.success('配置已保存')
        dialogVisible.value = false
      } catch (error) {
        ElMessage.error('请检查配置项是否正确')
      } finally {
        saving.value = false
      }
    }
    
    const handleClose = () => {
      // 重置表单数据
      formData.value = { ...defaultConfig, ...props.config }
      testResult.value = null
      testPassed.value = false
      dialogVisible.value = false
    }
    
    const handleReset = () => {
      formData.value = { ...defaultConfig }
      testResult.value = null
      testPassed.value = false
    }
    
    // 监听配置变化
    watch(() => props.config, (newConfig) => {
      if (newConfig) {
        formData.value = { ...defaultConfig, ...newConfig }
      }
    }, { deep: true })
    
    return {
      // 响应式数据
      formRef,
      activeTab,
      saving,
      testing,
      testResult,
      testPassed,
      formData,
      rules,
      
      // 计算属性
      dialogVisible,
      filteredModels,
      
      // 方法
      handleProviderChange,
      testConnection,
      testChat,
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

.test-section {
  .test-info {
    margin-bottom: 20px;
  }
  
  .test-controls {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .test-result {
    margin-top: 20px;
    
    .connection-info {
      .info-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        span:first-child {
          font-weight: 500;
          color: var(--el-text-color-regular);
        }
        
        span:last-child {
          color: var(--el-text-color-primary);
        }
      }
    }
  }
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-slider) {
  margin-right: 20px;
}

:deep(.el-tabs__content) {
  overflow: visible;
}
</style>