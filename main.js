// Electron 主进程入口文件

const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');
const path = require('path');
const { spawn } = require('child_process');

// 配置自动更新
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}

class TemctlApp {
  constructor() {
    this.mainWindow = null;
    this.backendProcess = null;
    this.isQuiting = false;
    
    this.init();
  }

  init() {
    // 应用事件监听
    app.whenReady().then(() => this.createWindow());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('before-quit', () => this.onBeforeQuit());
    app.on('will-quit', (event) => this.onWillQuit(event));

    // IPC 事件监听
    this.setupIpcHandlers();

    // 安全设置
    this.setupSecurity();

    // 启动后端服务
    this.startBackendService();
  }

  createWindow() {
    // 创建主窗口
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: !isDev
      },
      icon: path.join(__dirname, 'assets/icon.png'),
      show: false // 先隐藏，等待ready-to-show事件
    });

    // 窗口事件
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      if (isDev) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.on('close', (event) => {
      if (process.platform === 'darwin' && !this.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });

    // 加载应用
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      this.mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    // 创建应用菜单
    this.createMenu();
  }

  createMenu() {
    const template = [
      {
        label: 'Temctl',
        submenu: [
          {
            label: '关于 Temctl',
            role: 'about'
          },
          { type: 'separator' },
          {
            label: '偏好设置...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.mainWindow.webContents.send('menu-preferences');
            }
          },
          { type: 'separator' },
          {
            label: '隐藏 Temctl',
            accelerator: 'CmdOrCtrl+H',
            role: 'hide'
          },
          {
            label: '隐藏其他',
            accelerator: 'CmdOrCtrl+Shift+H',
            role: 'hideothers'
          },
          {
            label: '显示全部',
            role: 'unhide'
          },
          { type: 'separator' },
          {
            label: '退出',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              this.isQuiting = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: '文件',
        submenu: [
          {
            label: '新建连接',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow.webContents.send('new-connection');
            }
          },
          {
            label: '连接管理器',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: () => {
              this.mainWindow.webContents.send('show-connection-manager');
            }
          },
          { type: 'separator' },
          {
            label: '导入配置',
            click: () => this.importConfig()
          },
          {
            label: '导出配置',
            click: () => this.exportConfig()
          }
        ]
      },
      {
        label: '工具',
        submenu: [
          {
            label: 'AI助手',
            accelerator: 'CmdOrCtrl+Shift+A',
            click: () => {
              this.mainWindow.webContents.send('toggle-ai-assistant');
            }
          },
          {
            label: '文件传输',
            accelerator: 'CmdOrCtrl+Shift+F',
            click: () => {
              this.mainWindow.webContents.send('show-file-transfer');
            }
          },
          { type: 'separator' },
          {
            label: '系统信息',
            click: () => this.showSystemInfo()
          }
        ]
      },
      {
        label: '窗口',
        submenu: [
          {
            label: '最小化',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize'
          },
          {
            label: '关闭',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
          },
          { type: 'separator' },
          {
            label: '前置所有窗口',
            role: 'front'
          }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '用户手册',
            click: () => {
              shell.openExternal('https://docs.temctl.com');
            }
          },
          {
            label: '快捷键',
            click: () => this.showShortcuts()
          },
          { type: 'separator' },
          {
            label: '检查更新',
            click: () => {
              autoUpdater.checkForUpdatesAndNotify();
            }
          },
          {
            label: '报告问题',
            click: () => {
              shell.openExternal('https://github.com/username/temctl/issues');
            }
          }
        ]
      }
    ];

    // Windows/Linux 菜单调整
    if (process.platform !== 'darwin') {
      template.shift(); // 移除macOS特有的应用菜单
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupIpcHandlers() {
    // 文件对话框
    ipcMain.handle('show-open-dialog', async (event, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow, options);
      return result;
    });

    ipcMain.handle('show-save-dialog', async (event, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow, options);
      return result;
    });

    // 消息框
    ipcMain.handle('show-message-box', async (event, options) => {
      const result = await dialog.showMessageBox(this.mainWindow, options);
      return result;
    });

    // 应用控制
    ipcMain.handle('app-quit', () => {
      this.isQuiting = true;
      app.quit();
    });

    ipcMain.handle('app-restart', () => {
      app.relaunch();
      app.quit();
    });

    ipcMain.handle('app-version', () => {
      return app.getVersion();
    });

    // 窗口控制
    ipcMain.handle('window-minimize', () => {
      this.mainWindow.minimize();
    });

    ipcMain.handle('window-maximize', () => {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    });

    ipcMain.handle('window-close', () => {
      this.mainWindow.close();
    });

    // 系统信息
    ipcMain.handle('get-system-info', () => {
      const os = require('os');
      return {
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome
      };
    });
  }

  setupSecurity() {
    // 防止新窗口打开
    app.on('web-contents-created', (event, contents) => {
      contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      });
    });

    // CSP设置
    if (!isDev) {
      app.on('web-contents-created', (event, contents) => {
        contents.session.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data: https:; " +
                "connect-src 'self' ws: wss: https:;"
              ]
            }
          });
        });
      });
    }
  }

  startBackendService() {
    if (!isDev) {
      // 生产环境启动内嵌后端服务
      const backendPath = path.join(__dirname, 'backend/app.js');
      this.backendProcess = spawn('node', [backendPath], {
        cwd: path.join(__dirname, 'backend'),
        env: { ...process.env, NODE_ENV: 'production' }
      });

      this.backendProcess.on('error', (error) => {
        console.error('后端服务启动失败:', error);
      });

      this.backendProcess.on('close', (code) => {
        console.log(`后端服务退出，代码: ${code}`);
      });
    }
  }

  async importConfig() {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: '导入配置文件',
      filters: [
        { name: '配置文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      this.mainWindow.webContents.send('import-config', result.filePaths[0]);
    }
  }

  async exportConfig() {
    const result = await dialog.showSaveDialog(this.mainWindow, {
      title: '导出配置文件',
      defaultPath: 'temctl-config.json',
      filters: [
        { name: '配置文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      this.mainWindow.webContents.send('export-config', result.filePath);
    }
  }

  showSystemInfo() {
    this.mainWindow.webContents.send('show-system-info');
  }

  showShortcuts() {
    this.mainWindow.webContents.send('show-shortcuts');
  }

  onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      this.cleanup();
      app.quit();
    }
  }

  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    } else if (this.mainWindow) {
      this.mainWindow.show();
    }
  }

  onBeforeQuit() {
    this.isQuiting = true;
  }

  onWillQuit(event) {
    if (this.backendProcess && !this.backendProcess.killed) {
      event.preventDefault();
      
      // 优雅关闭后端服务
      this.backendProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (!this.backendProcess.killed) {
          this.backendProcess.kill('SIGKILL');
        }
        app.quit();
      }, 5000);
    }
  }

  cleanup() {
    if (this.backendProcess && !this.backendProcess.killed) {
      this.backendProcess.kill('SIGTERM');
    }
  }
}

// 创建应用实例
new TemctlApp();

// 自动更新事件
autoUpdater.on('checking-for-update', () => {
  console.log('检查更新中...');
});

autoUpdater.on('update-available', (info) => {
  console.log('发现更新:', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('已是最新版本:', info);
});

autoUpdater.on('error', (err) => {
  console.log('自动更新错误:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "下载速度: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - 已下载 ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('更新已下载:', info);
  autoUpdater.quitAndInstall();
});