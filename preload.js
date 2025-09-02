// Electron 预加载脚本 - 安全的渲染进程API桥接

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用控制
  app: {
    quit: () => ipcRenderer.invoke('app-quit'),
    restart: () => ipcRenderer.invoke('app-restart'),
    getVersion: () => ipcRenderer.invoke('app-version'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info')
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close')
  },

  // 对话框
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options)
  },

  // 文件系统
  fs: {
    readFile: (path) => ipcRenderer.invoke('fs-read-file', path),
    writeFile: (path, data) => ipcRenderer.invoke('fs-write-file', path, data),
    exists: (path) => ipcRenderer.invoke('fs-exists', path),
    mkdir: (path) => ipcRenderer.invoke('fs-mkdir', path)
  },

  // 事件监听
  on: (channel, callback) => {
    const validChannels = [
      'menu-preferences',
      'new-connection',
      'show-connection-manager',
      'toggle-ai-assistant',
      'show-file-transfer',
      'import-config',
      'export-config',
      'show-system-info',
      'show-shortcuts'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  // 移除事件监听
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // 发送消息到主进程
  send: (channel, data) => {
    const validChannels = [
      'config-imported',
      'config-exported',
      'ready-to-show'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  }
});

// 平台信息
contextBridge.exposeInMainWorld('platform', {
  isWindows: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  arch: process.arch,
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron
});

// 开发模式标识
contextBridge.exposeInMainWorld('isDev', process.env.NODE_ENV === 'development');

console.log('预加载脚本已加载');