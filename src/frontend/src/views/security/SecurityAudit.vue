<template>
  <div class="security-audit">
    <div class="page-header">
      <h1>安全审计</h1>
      <p class="subtitle">命令审核和安全管控</p>
    </div>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <el-row :gutter="24">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon danger">
                <el-icon><Lock /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.blockedCommands }}</div>
                <div class="stat-label">已拦截命令</div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon warning">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.riskyCommands }}</div>
                <div class="stat-label">风险命令</div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon success">
                <el-icon><Select /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.allowedCommands }}</div>
                <div class="stat-label">通过命令</div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon info">
                <el-icon><Document /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalAudits }}</div>
                <div class="stat-label">总审计数</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 主要内容 -->
    <div class="main-content">
      <!-- 安全配置 -->
      <el-card class="config-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>安全配置</span>
            <el-button type="primary" @click="saveSecurityConfig" :loading="saving">
              保存配置
            </el-button>
          </div>
        </template>

        <el-form :model="securityConfig" label-width="150px">
          <el-form-item label="启用命令审核">
            <el-switch 
              v-model="securityConfig.auditEnabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>

          <el-form-item label="自动拦截模式">
            <el-switch 
              v-model="securityConfig.autoBlock"
              active-text="启用"
              inactive-text="禁用"
            />
            <div class="field-tip">启用后将自动拦截危险命令</div>
          </el-form-item>

          <el-form-item label="审核策略">
            <el-radio-group v-model="securityConfig.auditMode">
              <el-radio label="strict">严格模式</el-radio>
              <el-radio label="normal">普通模式</el-radio>
              <el-radio label="loose">宽松模式</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="白名单用户">
            <el-select 
              v-model="securityConfig.whitelistUsers"
              multiple
              filterable
              allow-create
              placeholder="添加白名单用户"
              style="width: 100%"
            >
              <el-option
                v-for="user in allUsers"
                :key="user"
                :label="user"
                :value="user"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="通知设置">
            <el-checkbox-group v-model="securityConfig.notifications">
              <el-checkbox label="email">邮件通知</el-checkbox>
              <el-checkbox label="desktop">桌面通知</el-checkbox>
              <el-checkbox label="log">日志记录</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 危险命令管理 -->
      <el-card class="command-rules" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>危险命令规则</span>
            <el-button @click="addCommandRule">添加规则</el-button>
          </div>
        </template>

        <el-table :data="commandRules" stripe>
          <el-table-column prop="pattern" label="命令模式" width="200">
            <template #default="scope">
              <code>{{ scope.row.pattern }}</code>
            </template>
          </el-table-column>
          
          <el-table-column prop="level" label="风险等级" width="100">
            <template #default="scope">
              <el-tag 
                :type="getRiskType(scope.row.level)"
                size="small"
              >
                {{ getRiskText(scope.row.level) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="action" label="处理动作" width="100">
            <template #default="scope">
              <el-tag 
                :type="getActionType(scope.row.action)"
                size="small"
              >
                {{ getActionText(scope.row.action) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="description" label="描述" />
          
          <el-table-column prop="enabled" label="状态" width="80">
            <template #default="scope">
              <el-switch 
                v-model="scope.row.enabled"
                @change="updateCommandRule(scope.row)"
              />
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="150">
            <template #default="scope">
              <el-button 
                type="text" 
                size="small" 
                @click="editCommandRule(scope.row)"
              >
                编辑
              </el-button>
              <el-button 
                type="text" 
                size="small" 
                class="danger-text"
                @click="deleteCommandRule(scope.row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 审计日志 -->
      <el-card class="audit-logs" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>最近审计记录</span>
            <div class="header-actions">
              <el-input
                v-model="searchText"
                placeholder="搜索命令或用户"
                clearable
                style="width: 200px; margin-right: 12px"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-button @click="refreshAuditLogs">刷新</el-button>
              <el-button @click="exportAuditLogs">导出</el-button>
            </div>
          </div>
        </template>

        <el-table :data="filteredAuditLogs" stripe max-height="400">
          <el-table-column prop="timestamp" label="时间" width="160">
            <template #default="scope">
              {{ formatDate(scope.row.timestamp) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="username" label="用户" width="100" />
          
          <el-table-column prop="hostname" label="主机" width="150" />
          
          <el-table-column prop="command" label="命令" min-width="200">
            <template #default="scope">
              <code class="command-text">{{ scope.row.command }}</code>
            </template>
          </el-table-column>
          
          <el-table-column prop="result" label="结果" width="100">
            <template #default="scope">
              <el-tag 
                :type="scope.row.result === 'allowed' ? 'success' : 'danger'"
                size="small"
              >
                {{ scope.row.result === 'allowed' ? '通过' : '拦截' }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="riskLevel" label="风险等级" width="100">
            <template #default="scope">
              <el-tag 
                :type="getRiskType(scope.row.riskLevel)"
                size="small"
              >
                {{ getRiskText(scope.row.riskLevel) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="80">
            <template #default="scope">
              <el-button 
                type="text" 
                size="small" 
                @click="viewAuditDetail(scope.row)"
              >
                详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="totalAuditLogs"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadAuditLogs"
            @current-change="loadAuditLogs"
          />
        </div>
      </el-card>
    </div>

    <!-- 命令规则对话框 -->
    <el-dialog 
      v-model="ruleDialogVisible"
      :title="editingRule ? '编辑规则' : '添加规则'"
      width="600px"
    >
      <el-form :model="ruleForm" :rules="ruleRules" ref="ruleFormRef" label-width="100px">
        <el-form-item label="命令模式" prop="pattern">
          <el-input 
            v-model="ruleForm.pattern" 
            placeholder="如：rm -rf *"
          />
        </el-form-item>
        
        <el-form-item label="风险等级" prop="level">
          <el-select v-model="ruleForm.level" style="width: 100%">
            <el-option label="低风险" value="low" />
            <el-option label="中风险" value="medium" />
            <el-option label="高风险" value="high" />
            <el-option label="极高风险" value="critical" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="处理动作" prop="action">
          <el-select v-model="ruleForm.action" style="width: 100%">
            <el-option label="允许" value="allow" />
            <el-option label="警告" value="warn" />
            <el-option label="拦截" value="block" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="描述" prop="description">
          <el-input 
            v-model="ruleForm.description" 
            type="textarea"
            :rows="3"
            placeholder="规则描述"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCommandRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'SecurityAudit',
  setup() {
    const store = useStore();

    const saving = ref(false);
    const searchText = ref('');
    const currentPage = ref(1);
    const pageSize = ref(20);
    const ruleDialogVisible = ref(false);
    const editingRule = ref(null);
    const ruleFormRef = ref(null);

    // 安全配置
    const securityConfig = ref({
      auditEnabled: true,
      autoBlock: true,
      auditMode: 'normal',
      whitelistUsers: [],
      notifications: ['log', 'desktop']
    });

    // 统计数据
    const stats = ref({
      blockedCommands: 15,
      riskyCommands: 8,
      allowedCommands: 234,
      totalAudits: 257
    });

    // 命令规则
    const commandRules = ref([
      {
        id: 1,
        pattern: 'rm -rf /',
        level: 'critical',
        action: 'block',
        description: '删除根目录命令',
        enabled: true
      },
      {
        id: 2,
        pattern: 'dd if=*',
        level: 'high',
        action: 'warn',
        description: 'dd命令可能造成数据丢失',
        enabled: true
      },
      {
        id: 3,
        pattern: 'chmod 777 *',
        level: 'medium',
        action: 'warn',
        description: '设置过于宽松的权限',
        enabled: true
      }
    ]);

    // 审计日志
    const auditLogs = ref([
      {
        id: 1,
        timestamp: new Date().toISOString(),
        username: 'admin',
        hostname: 'web-server-01',
        command: 'ls -la /home',
        result: 'allowed',
        riskLevel: 'low'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 300000).toISOString(),
        username: 'user1',
        hostname: 'db-server-01',
        command: 'rm -rf /tmp/logs',
        result: 'blocked',
        riskLevel: 'high'
      }
    ]);

    // 规则表单
    const ruleForm = ref({
      pattern: '',
      level: 'medium',
      action: 'warn',
      description: ''
    });

    // 规则表单验证
    const ruleRules = {
      pattern: [
        { required: true, message: '请输入命令模式', trigger: 'blur' }
      ],
      level: [
        { required: true, message: '请选择风险等级', trigger: 'change' }
      ],
      action: [
        { required: true, message: '请选择处理动作', trigger: 'change' }
      ]
    };

    // 计算属性
    const allUsers = computed(() => {
      return ['admin', 'user1', 'user2', 'deploy', 'developer'];
    });

    const filteredAuditLogs = computed(() => {
      if (!searchText.value) {
        return auditLogs.value;
      }
      return auditLogs.value.filter(log => 
        log.command.toLowerCase().includes(searchText.value.toLowerCase()) ||
        log.username.toLowerCase().includes(searchText.value.toLowerCase()) ||
        log.hostname.toLowerCase().includes(searchText.value.toLowerCase())
      );
    });

    const totalAuditLogs = computed(() => {
      return filteredAuditLogs.value.length;
    });

    // 工具方法
    const getRiskType = (level) => {
      const typeMap = {
        low: 'success',
        medium: 'warning',
        high: 'danger',
        critical: 'danger'
      };
      return typeMap[level] || 'info';
    };

    const getRiskText = (level) => {
      const textMap = {
        low: '低风险',
        medium: '中风险',
        high: '高风险',
        critical: '极高风险'
      };
      return textMap[level] || '未知';
    };

    const getActionType = (action) => {
      const typeMap = {
        allow: 'success',
        warn: 'warning',
        block: 'danger'
      };
      return typeMap[action] || 'info';
    };

    const getActionText = (action) => {
      const textMap = {
        allow: '允许',
        warn: '警告',
        block: '拦截'
      };
      return textMap[action] || '未知';
    };

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    };

    // 方法
    const saveSecurityConfig = async () => {
      try {
        saving.value = true;
        
        // 调用API保存配置
        await store.dispatch('security/updateConfig', securityConfig.value);
        
        ElMessage.success('安全配置已保存');
      } catch (error) {
        ElMessage.error(`保存失败: ${error.message}`);
      } finally {
        saving.value = false;
      }
    };

    const addCommandRule = () => {
      editingRule.value = null;
      ruleForm.value = {
        pattern: '',
        level: 'medium',
        action: 'warn',
        description: ''
      };
      ruleDialogVisible.value = true;
    };

    const editCommandRule = (rule) => {
      editingRule.value = rule;
      ruleForm.value = { ...rule };
      ruleDialogVisible.value = true;
    };

    const saveCommandRule = async () => {
      try {
        const valid = await ruleFormRef.value.validate();
        if (!valid) return;

        if (editingRule.value) {
          // 更新规则
          Object.assign(editingRule.value, ruleForm.value);
        } else {
          // 添加新规则
          const newRule = {
            ...ruleForm.value,
            id: Date.now(),
            enabled: true
          };
          commandRules.value.push(newRule);
        }

        // TODO: 调用API保存规则
        
        ruleDialogVisible.value = false;
        ElMessage.success('规则已保存');
        
      } catch (error) {
        ElMessage.error(`保存失败: ${error.message}`);
      }
    };

    const updateCommandRule = async (rule) => {
      try {
        // TODO: 调用API更新规则状态
        ElMessage.success(`规则已${rule.enabled ? '启用' : '禁用'}`);
      } catch (error) {
        ElMessage.error(`更新失败: ${error.message}`);
      }
    };

    const deleteCommandRule = async (rule) => {
      try {
        await ElMessageBox.confirm('确认删除此规则吗？', '提示', {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: 'warning'
        });

        const index = commandRules.value.findIndex(r => r.id === rule.id);
        if (index > -1) {
          commandRules.value.splice(index, 1);
        }

        // TODO: 调用API删除规则
        
        ElMessage.success('规则已删除');
        
      } catch {
        // 取消删除
      }
    };

    const loadAuditLogs = async () => {
      try {
        // TODO: 从后端加载审计日志
        console.log('加载审计日志', { currentPage: currentPage.value, pageSize: pageSize.value });
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      }
    };

    const refreshAuditLogs = () => {
      loadAuditLogs();
      ElMessage.success('审计日志已刷新');
    };

    const exportAuditLogs = () => {
      // TODO: 导出审计日志
      ElMessage.success('导出功能开发中');
    };

    const viewAuditDetail = (log) => {
      // TODO: 显示审计详情
      console.log('查看审计详情', log);
    };

    // 初始化
    onMounted(() => {
      loadAuditLogs();
    });

    return {
      saving,
      searchText,
      currentPage,
      pageSize,
      ruleDialogVisible,
      editingRule,
      ruleFormRef,
      securityConfig,
      stats,
      commandRules,
      auditLogs,
      ruleForm,
      ruleRules,
      allUsers,
      filteredAuditLogs,
      totalAuditLogs,
      getRiskType,
      getRiskText,
      getActionType,
      getActionText,
      formatDate,
      saveSecurityConfig,
      addCommandRule,
      editCommandRule,
      saveCommandRule,
      updateCommandRule,
      deleteCommandRule,
      loadAuditLogs,
      refreshAuditLogs,
      exportAuditLogs,
      viewAuditDetail
    };
  }
};
</script>

<style lang="scss" scoped>
.security-audit {
  padding: var(--space-lg);
  height: 100%;
  overflow-y: auto;
}

.page-header {
  margin-bottom: var(--space-lg);
  
  h1 {
    font-size: var(--font-size-extra-large);
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: var(--space-sm);
  }
  
  .subtitle {
    color: var(--text-color-secondary);
    font-size: var(--font-size-base);
  }
}

.stats-overview {
  margin-bottom: var(--space-lg);
  
  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      
      .stat-icon {
        width: 50px;
        height: 50px;
        border-radius: var(--border-radius-base);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        
        &.danger {
          background: var(--danger-color);
          color: white;
        }
        
        &.warning {
          background: var(--warning-color);
          color: white;
        }
        
        &.success {
          background: var(--success-color);
          color: white;
        }
        
        &.info {
          background: var(--info-color);
          color: white;
        }
      }
      
      .stat-info {
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-color-primary);
          margin-bottom: 2px;
        }
        
        .stat-label {
          font-size: var(--font-size-small);
          color: var(--text-color-secondary);
        }
      }
    }
  }
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

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
    align-items: center;
  }
}

.field-tip {
  font-size: var(--font-size-small);
  color: var(--text-color-secondary);
  margin-top: var(--space-xs);
}

.command-text {
  font-family: monospace;
  background: var(--fill-color-light);
  padding: 2px 4px;
  border-radius: var(--border-radius-small);
  font-size: 12px;
}

.danger-text {
  color: var(--danger-color) !important;
}

.pagination-container {
  margin-top: var(--space-lg);
  text-align: right;
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    
    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
}
</style>