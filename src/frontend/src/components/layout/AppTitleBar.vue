<template>
  <!-- Windows平台的标题栏 -->
  <div class="title-bar" v-if="!isMacOS">
    <div class="title">
      Temctl - 跨平台AI终端工具
    </div>
    <div class="window-controls">
      <div class="control-btn minimize" @click="minimizeWindow"></div>
      <div class="control-btn maximize" @click="maximizeWindow"></div>
      <div class="control-btn close" @click="closeWindow"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppTitleBar',
  computed: {
    isMacOS() {
      return process.platform === 'darwin';
    }
  },
  methods: {
    minimizeWindow() {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('app-minimize');
      }
    },
    
    maximizeWindow() {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('app-maximize');
      }
    },
    
    closeWindow() {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('app-quit');
      }
    }
  }
};
</script>