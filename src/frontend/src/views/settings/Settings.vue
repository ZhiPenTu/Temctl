<template>
  <div class="settings">
    <div class="page-header">
      <h1>设置</h1>
      <p class="subtitle">应用程序配置和偏好设置</p>
    </div>

    <div class="settings-layout">
      <!-- 左侧菜单 -->
      <div class="settings-sidebar">
        <el-menu v-model="activeSection" mode="vertical">
          <el-menu-item index="general">
            <el-icon><Setting /></el-icon>
            <span>常规设置</span>
          </el-menu-item>
          <el-menu-item index="appearance">
            <el-icon><Monitor /></el-icon>
            <span>外观主题</span>
          </el-menu-item>
          <el-menu-item index="security">
            <el-icon><Lock /></el-icon>
            <span>安全设置</span>
          </el-menu-item>
          <el-menu-item index="ai">
            <el-icon><ChatDotRound /></el-icon>
            <span>AI配置</span>
          </el-menu-item>
          <el-menu-item index="about">
            <el-icon><InfoFilled /></el-icon>
            <span>关于应用</span>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 右侧内容 -->
      <div class="settings-content">
        <!-- 常规设置 -->
        <div v-show="activeSection === 'general'" class="settings-section">
          <el-card shadow="hover">
            <template #header><span>常规设置</span></template>
            <el-form :model="settings.general" label-width="150px">
              <el-form-item label="应用语言">
                <el-select v-model="settings.general.language">
                  <el-option label="简体中文" value="zh-CN" />
                  <el-option label="English" value="en-US" />
                </el-select>
              </el-form-item>
              <el-form-item label="启动时最小化">
                <el-switch v-model="settings.general.startMinimized" />
              </el-form-item>
              <el-form-item label="开机自启动">
                <el-switch v-model="settings.general.autoStart" />
              </el-form-item>
            </el-form>
          </el-card>
        </div>

        <!-- 外观设置 -->
        <div v-show="activeSection === 'appearance'" class="settings-section">
          <el-card shadow="hover">
            <template #header><span>外观主题</span></template>
            <el-form :model="settings.appearance" label-width="150px">
              <el-form-item label="主题模式">
                <el-radio-group v-model="settings.appearance.theme">
                  <el-radio label="auto">跟随系统</el-radio>
                  <el-radio label="light">浅色主题</el-radio>
                  <el-radio label="dark">深色主题</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="字体大小">
                <el-slider v-model="settings.appearance.fontSize" :min="12" :max="18" />
              </el-form-item>
            </el-form>
          </el-card>
        </div>

        <!-- 安全设置 -->
        <div v-show="activeSection === 'security'" class="settings-section">
          <el-card shadow="hover">
            <template #header><span>安全设置</span></template>
            <el-form :model="settings.security" label-width="150px">
              <el-form-item label="主密码保护">
                <el-switch v-model="settings.security.masterPasswordEnabled" />
              </el-form-item>
              <el-form-item label="记住密码">
                <el-switch v-model="settings.security.rememberPasswords" />
              </el-form-item>
            </el-form>
          </el-card>
        </div>

        <!-- AI配置 -->
        <div v-show="activeSection === 'ai'" class="settings-section">
          <el-card shadow="hover">
            <template #header><span>AI配置</span></template>
            <el-form :model="settings.ai" label-width="150px">
              <el-form-item label="默认提供商">
                <el-select v-model="settings.ai.defaultProvider">
                  <el-option label="OpenAI" value="openai" />
                  <el-option label="本地模型" value="ollama" />
                </el-select>
              </el-form-item>
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.apiKey" type="password" show-password />
              </el-form-item>
            </el-form>
          </el-card>
        </div>

        <!-- 关于应用 -->
        <div v-show="activeSection === 'about'" class="settings-section">
          <el-card shadow="hover">
            <template #header><span>关于应用</span></template>
            <div class="about-content">
              <h2>Temctl</h2>
              <p>版本 1.0.0</p>
              <p>跨平台AI终端工具</p>
              <el-button @click="checkUpdate" :loading="checking">检查更新</el-button>
            </div>
          </el-card>
        </div>

        <!-- 保存按钮 -->
        <div class="settings-actions">
          <el-button type="primary" @click="saveSettings" :loading="saving">保存设置</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import { ElMessage } from 'element-plus';

export default {
  name: 'Settings',
  setup() {
    const store = useStore();
    const activeSection = ref('general');
    const saving = ref(false);
    const checking = ref(false);

    const settings = ref({
      general: { language: 'zh-CN', startMinimized: false, autoStart: false },
      appearance: { theme: 'auto', fontSize: 14 },
      security: { masterPasswordEnabled: false, rememberPasswords: true },
      ai: { defaultProvider: 'openai', apiKey: '' }
    });

    const saveSettings = async () => {
      try {
        saving.value = true;
        await store.dispatch('settings/updateSettings', settings.value);
        ElMessage.success('设置已保存');
      } catch (error) {
        ElMessage.error(`保存失败: ${error.message}`);
      } finally {
        saving.value = false;
      }
    };

    const checkUpdate = async () => {
      try {
        checking.value = true;
        await new Promise(resolve => setTimeout(resolve, 1000));
        ElMessage.success('当前已是最新版本');
      } finally {
        checking.value = false;
      }
    };

    onMounted(async () => {
      try {
        const existingSettings = await store.dispatch('settings/loadSettings');
        if (existingSettings) {
          Object.assign(settings.value, existingSettings);
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    });

    return { activeSection, saving, checking, settings, saveSettings, checkUpdate };
  }
};
</script>

<style lang="scss" scoped>
.settings {
  padding: var(--space-lg);
  height: 100%;
  overflow: hidden;
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
  }
}

.settings-layout {
  display: flex;
  height: calc(100% - 100px);
  gap: var(--space-lg);
}

.settings-sidebar {
  width: 200px;
  flex-shrink: 0;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
}

.about-content {
  text-align: center;
  padding: var(--space-lg);
  
  h2 {
    font-size: 24px;
    margin-bottom: var(--space-md);
  }
}

.settings-actions {
  position: sticky;
  bottom: 0;
  background: var(--bg-color-overlay);
  padding: var(--space-lg) 0;
  border-top: 1px solid var(--border-color);
}
</style>