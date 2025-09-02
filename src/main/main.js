const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// 保持对window对象的全局引用，避免被垃圾回收
let mainWindow;

/**
 * 创建主窗口
 */
function createMainWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  });

  // 加载应用
  if (isDev) {
    // 开发模式加载开发服务器
    mainWindow.loadURL('http://localhost:3000');
    // 打开开发工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式加载静态文件
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // macOS下聚焦窗口
    if (process.platform === 'darwin') {
      mainWindow.focus();
    }
  });

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置应用菜单
  createApplicationMenu();
}

/**
 * 创建应用菜单
 */
function createApplicationMenu() {
  const template = [
    {
      label: 'Temctl',
      submenu: [
        {
          label: '关于 Temctl',
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: '偏好设置...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-preferences');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '隐藏 Temctl',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: '隐藏其他',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: '显示全部',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
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
            mainWindow.webContents.send('new-connection');
          }
        },
        {
          label: '导入配置',
          click: () => {
            mainWindow.webContents.send('import-config');
          }
        },
        {
          label: '导出配置',
          click: () => {
            mainWindow.webContents.send('export-config');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '关闭连接',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow.webContents.send('close-connection');
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo'
        },
        {
          label: '重做',
          accelerator: 'Shift+CmdOrCtrl+Z',
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          label: '剪切',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: '复制',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: '粘贴',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: '全选',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
        },
        {
          type: 'separator'
        },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow.webContents.send('show-search');
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload();
          }
        },
        {
          label: '强制刷新',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.reloadIgnoringCache();
          }
        },
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        {
          type: 'separator'
        },
        {
          label: '实际大小',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetzoom'
        },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+Plus',
          role: 'zoomin'
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomout'
        },
        {
          type: 'separator'
        },
        {
          label: '全屏',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          role: 'togglefullscreen'
        }
      ]
    },
    {
      label: '连接',
      submenu: [
        {
          label: '快速连接',
          accelerator: 'CmdOrCtrl+Shift+Q',
          click: () => {
            mainWindow.webContents.send('quick-connect');
          }
        },
        {
          label: '断开所有连接',
          click: () => {
            mainWindow.webContents.send('disconnect-all');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '连接管理器',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            mainWindow.webContents.send('show-connection-manager');
          }
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
            mainWindow.webContents.send('toggle-ai-assistant');
          }
        },
        {
          label: '文件传输',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('show-file-transfer');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '安全审计',
          click: () => {
            mainWindow.webContents.send('show-security-audit');
          }
        },
        {
          label: '操作日志',
          click: () => {
            mainWindow.webContents.send('show-operation-logs');
          }
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
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '用户手册',
          click: () => {
            mainWindow.webContents.send('show-user-manual');
          }
        },
        {
          label: '快捷键',
          click: () => {
            mainWindow.webContents.send('show-shortcuts');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '反馈问题',
          click: () => {
            require('electron').shell.openExternal('https://github.com/ZhiPenTu/Temctl/issues');
          }
        },
        {
          label: '检查更新',
          click: () => {
            mainWindow.webContents.send('check-updates');
          }
        }
      ]
    }
  ];

  // macOS菜单调整
  if (process.platform === 'darwin') {
    template[0].submenu.unshift({
      label: '服务',
      submenu: []
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 应用准备就绪
app.whenReady().then(createMainWindow);

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS应用激活时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// 阻止导航到外部URL
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});

// IPC消息处理
ipcMain.on('app-quit', () => {
  app.quit();
});

ipcMain.on('app-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('app-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// 导出主窗口引用供其他模块使用
module.exports = {
  getMainWindow: () => mainWindow
};