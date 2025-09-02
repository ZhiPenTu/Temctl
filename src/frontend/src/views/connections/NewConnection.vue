<template>
  <div class="new-connection">
    <div class="page-header">
      <el-page-header @back="goBack" content="新建连接" />
    </div>

    <div class="form-container">
      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span>连接配置</span>
            <div class="header-actions">
              <el-button @click="testConnection" :loading="testing">测试连接</el-button>
              <el-button type="primary" @click="saveConnection" :loading="saving">保存</el-button>
            </div>
          </div>
        </template>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="120px"
          @submit.prevent="saveConnection"
        >
          <!-- 基础信息 -->
          <el-divider content-position="left">基础信息</el-divider>
          
          <el-form-item label="连接名称" prop="name" required>
            <el-input 
              v-model="form.name" 
              placeholder="输入连接名称"
              clearable
            />
          </el-form-item>

          <el-form-item label="主机地址" prop="hostname" required>
            <el-input 
              v-model="form.hostname" 
              placeholder="IP地址或域名"
              clearable
            />
          </el-form-item>

          <el-form-item label="端口" prop="port" required>
            <el-input-number 
              v-model="form.port" 
              :min="1" 
              :max="65535"
              placeholder="22"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="用户名" prop="username" required>
            <el-input 
              v-model="form.username" 
              placeholder="SSH用户名"
              clearable
            />
          </el-form-item>

          <!-- 认证配置 -->
          <el-divider content-position="left">认证配置</el-divider>
          
          <el-form-item label="认证方式" prop="authType" required>
            <el-radio-group v-model="form.authType">
              <el-radio label="password">密码认证</el-radio>
              <el-radio label="key">密钥认证</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 密码认证 -->
          <template v-if="form.authType === 'password'">
            <el-form-item label="密码" prop="password">
              <el-input 
                v-model="form.password" 
                type="password" 
                placeholder="SSH密码"
                show-password
                clearable
              />
            </el-form-item>
          </template>

          <!-- 密钥认证 -->
          <template v-if="form.authType === 'key'">
            <el-form-item label="私钥文件" prop="privateKeyPath">
              <div class="key-input-group">
                <el-input 
                  v-model="form.privateKeyPath" 
                  placeholder="选择私钥文件路径"
                  readonly
                />
                <el-button @click="selectPrivateKey" icon="FolderOpened">选择</el-button>
              </div>
            </el-form-item>

            <el-form-item label="私钥密码" prop="passphrase">
              <el-input 
                v-model="form.passphrase" 
                type="password" 
                placeholder="私钥密码（如果有）"
                show-password
                clearable
              />
            </el-form-item>
          </template>

          <!-- 高级选项 -->
          <el-divider content-position="left">
            <el-button text @click="showAdvanced = !showAdvanced">
              高级选项
              <el-icon><component :is="showAdvanced ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
            </el-button>
          </el-divider>

          <el-collapse-transition>
            <div v-show="showAdvanced">
              <el-form-item label="分组">
                <el-select 
                  v-model="form.group" 
                  placeholder="选择或输入分组名称"
                  filterable
                  allow-create
                  clearable
                >
                  <el-option
                    v-for="group in hostGroups"
                    :key="group"
                    :label="group"
                    :value="group"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="标签">
                <el-select 
                  v-model="form.tags" 
                  placeholder="选择或添加标签"
                  multiple
                  filterable
                  allow-create
                  clearable
                >
                  <el-option
                    v-for="tag in allTags"
                    :key="tag"
                    :label="tag"
                    :value="tag"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="连接超时">
                <el-input-number 
                  v-model="form.timeout" 
                  :min="5" 
                  :max="300"
                  placeholder="30"
                  controls-position="right"
                  style="width: 100%"
                />
                <span class="field-tip">秒</span>
              </el-form-item>

              <el-form-item label="保持连接">
                <el-switch 
                  v-model="form.keepAlive"
                  active-text="启用"
                  inactive-text="禁用"
                />
              </el-form-item>

              <el-form-item label="自动连接">
                <el-switch 
                  v-model="form.autoConnect"
                  active-text="启用"
                  inactive-text="禁用"
                />
              </el-form-item>

              <el-form-item label="备注">
                <el-input 
                  v-model="form.description" 
                  type="textarea" 
                  :rows="3"
                  placeholder="连接备注信息"
                />
              </el-form-item>
            </div>
          </el-collapse-transition>
        </el-form>
      </el-card>
    </div>

    <!-- 快速配置模板 -->
    <div class="template-section">
      <el-card shadow="hover">
        <template #header>
          <span>快速配置模板</span>
        </template>

        <div class="template-grid">
          <div 
            v-for="template in templates" 
            :key="template.id"
            class="template-item"
            @click="applyTemplate(template)"
          >
            <div class="template-icon">
              <el-icon><component :is="template.icon" /></el-icon>
            </div>
            <div class="template-info">
              <div class="template-name">{{ template.name }}</div>
              <div class="template-desc">{{ template.description }}</div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'NewConnection',
  setup() {
    const store = useStore();
    const router = useRouter();
    
    const formRef = ref(null);
    const testing = ref(false);
    const saving = ref(false);
    const showAdvanced = ref(false);

    // 表单数据
    const form = ref({
      name: '',
      hostname: '',
      port: 22,
      username: '',
      authType: 'password',
      password: '',
      privateKeyPath: '',
      passphrase: '',
      group: '',
      tags: [],
      timeout: 30,
      keepAlive: true,
      autoConnect: false,
      description: ''
    });

    // 表单验证规则
    const rules = {
      name: [
        { required: true, message: '请输入连接名称', trigger: 'blur' },
        { min: 1, max: 50, message: '名称长度应在 1 到 50 个字符', trigger: 'blur' }
      ],
      hostname: [
        { required: true, message: '请输入主机地址', trigger: 'blur' },
        { 
          pattern: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/,
          message: '请输入有效的IP地址或域名', 
          trigger: 'blur' 
        }
      ],
      port: [
        { required: true, message: '请输入端口号', trigger: 'blur' },
        { type: 'number', min: 1, max: 65535, message: '端口号应在 1 到 65535 之间', trigger: 'blur' }
      ],
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 1, max: 32, message: '用户名长度应在 1 到 32 个字符', trigger: 'blur' }
      ],
      password: [
        { 
          validator: (rule, value, callback) => {
            if (form.value.authType === 'password' && !value) {
              callback(new Error('请输入密码'));
            } else {
              callback();
            }
          }, 
          trigger: 'blur' 
        }
      ],
      privateKeyPath: [
        { 
          validator: (rule, value, callback) => {
            if (form.value.authType === 'key' && !value) {
              callback(new Error('请选择私钥文件'));
            } else {
              callback();
            }
          }, 
          trigger: 'blur' 
        }
      ]
    };

    // 获取主机分组
    const hostGroups = computed(() => {
      return [...new Set(store.state.hosts.hosts.map(host => host.group).filter(Boolean))];
    });

    // 获取所有标签
    const allTags = computed(() => {
      const tags = store.state.hosts.hosts.reduce((acc, host) => {
        if (host.tags && Array.isArray(host.tags)) {
          acc.push(...host.tags);
        }
        return acc;
      }, []);
      return [...new Set(tags)];
    });

    // 配置模板
    const templates = ref([
      {
        id: 'ubuntu-server',
        name: 'Ubuntu 服务器',
        description: '标准Ubuntu服务器配置',
        icon: 'Monitor',
        config: {
          port: 22,
          username: 'ubuntu',
          authType: 'key',
          group: '服务器',
          keepAlive: true
        }
      },
      {
        id: 'centos-server',
        name: 'CentOS 服务器',
        description: '标准CentOS服务器配置',
        icon: 'Monitor',
        config: {
          port: 22,
          username: 'root',
          authType: 'password',
          group: '服务器',
          keepAlive: true
        }
      },
      {
        id: 'router',
        name: '路由器设备',
        description: '网络设备连接配置',
        icon: 'Connection',
        config: {
          port: 22,
          username: 'admin',
          authType: 'password',
          group: '网络设备',
          timeout: 60
        }
      },
      {
        id: 'docker-container',
        name: 'Docker 容器',
        description: 'Docker容器SSH配置',
        icon: 'Box',
        config: {
          port: 22,
          username: 'root',
          authType: 'password',
          group: '容器',
          keepAlive: false
        }
      }
    ]);

    // 返回上一页
    const goBack = () => {
      router.push('/connections');
    };

    // 选择私钥文件
    const selectPrivateKey = async () => {
      try {
        // 这里应该调用Electron的文件选择对话框
        if (window.require) {
          const { ipcRenderer } = window.require('electron');
          const result = await ipcRenderer.invoke('show-open-dialog', {
            title: '选择私钥文件',
            filters: [
              { name: '私钥文件', extensions: ['pem', 'key', 'pub'] },
              { name: '所有文件', extensions: ['*'] }
            ],
            properties: ['openFile']
          });

          if (!result.canceled && result.filePaths.length > 0) {
            form.value.privateKeyPath = result.filePaths[0];
          }
        } else {
          // 开发环境模拟
          form.value.privateKeyPath = '/home/user/.ssh/id_rsa';
          ElMessage.success('已选择私钥文件');
        }
      } catch (error) {
        ElMessage.error('选择私钥文件失败');
      }
    };

    // 应用模板
    const applyTemplate = (template) => {
      Object.assign(form.value, template.config);
      ElMessage.success(`已应用模板: ${template.name}`);
    };

    // 测试连接
    const testConnection = async () => {
      try {
        // 先验证必填字段
        const valid = await formRef.value.validateField(['name', 'hostname', 'port', 'username']);
        if (!valid) return;

        testing.value = true;
        
        // 调用后端测试连接
        const result = await store.dispatch('hosts/testConnection', {
          hostname: form.value.hostname,
          port: form.value.port,
          username: form.value.username,
          authType: form.value.authType,
          password: form.value.password,
          privateKeyPath: form.value.privateKeyPath,
          passphrase: form.value.passphrase,
          timeout: form.value.timeout
        });

        if (result.success) {
          ElMessage.success('连接测试成功');
        } else {
          ElMessage.error(`连接测试失败: ${result.error}`);
        }
        
      } catch (error) {
        ElMessage.error(`连接测试失败: ${error.message}`);
      } finally {
        testing.value = false;
      }
    };

    // 保存连接
    const saveConnection = async () => {
      try {
        // 表单验证
        const valid = await formRef.value.validate();
        if (!valid) return;

        saving.value = true;

        // 创建主机配置
        const hostConfig = {
          ...form.value,
          id: generateId(),
          createdAt: new Date().toISOString(),
          status: 'disconnected'
        };

        // 保存到store
        await store.dispatch('hosts/addHost', hostConfig);

        ElMessage.success('连接配置已保存');
        
        // 询问是否立即连接
        try {
          await ElMessageBox.confirm('是否立即连接到此主机？', '提示', {
            confirmButtonText: '立即连接',
            cancelButtonText: '稍后连接',
            type: 'info'
          });
          
          // 跳转到连接详情页面
          router.push(`/connections/${hostConfig.id}`);
        } catch {
          // 返回连接列表
          router.push('/connections');
        }
        
      } catch (error) {
        ElMessage.error(`保存失败: ${error.message}`);
      } finally {
        saving.value = false;
      }
    };

    // 生成ID
    const generateId = () => {
      return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    };

    return {
      formRef,
      testing,
      saving,
      showAdvanced,
      form,
      rules,
      hostGroups,
      allTags,
      templates,
      goBack,
      selectPrivateKey,
      applyTemplate,
      testConnection,
      saveConnection
    };
  }
};
</script>

<style lang="scss" scoped>
.new-connection {
  padding: var(--space-lg);
  height: 100%;
  overflow-y: auto;
}

.page-header {
  margin-bottom: var(--space-lg);
}

.form-container {
  margin-bottom: var(--space-lg);
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      font-weight: 600;
      color: var(--text-color-primary);
    }
    
    .header-actions {
      display: flex;
      gap: var(--space-sm);
    }
  }
}

.key-input-group {
  display: flex;
  gap: var(--space-sm);
  
  .el-input {
    flex: 1;
  }
}

.field-tip {
  margin-left: var(--space-sm);
  color: var(--text-color-secondary);
  font-size: var(--font-size-small);
}

.template-section {
  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-md);
    
    .template-item {
      display: flex;
      align-items: center;
      padding: var(--space-md);
      border: 1px solid var(--border-color-lighter);
      border-radius: var(--border-radius-base);
      cursor: pointer;
      transition: all var(--transition-duration);
      
      &:hover {
        border-color: var(--primary-color);
        background: var(--fill-color-extra-light);
        transform: translateY(-2px);
        box-shadow: var(--box-shadow-light);
      }
      
      .template-icon {
        width: 40px;
        height: 40px;
        border-radius: var(--border-radius-base);
        background: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: var(--space-md);
        font-size: 20px;
      }
      
      .template-info {
        flex: 1;
        
        .template-name {
          font-weight: 500;
          color: var(--text-color-primary);
          margin-bottom: 2px;
        }
        
        .template-desc {
          font-size: var(--font-size-small);
          color: var(--text-color-secondary);
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start !important;
    gap: var(--space-md);
    
    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
}
</style>