# 架构设计文档

## 概览

Temctl 采用现代化的分层架构设计，基于 Electron + Vue + Node.js 技术栈构建跨平台桌面应用。本文档详细介绍了系统的整体架构、模块设计和技术选型。

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │   窗口管理       │  │   IPC通信        │  │  系统集成     ││
│  │   菜单管理       │  │   进程生命周期   │  │  自动更新     ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron 渲染进程                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 前端应用 (Vue 3)                         ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │    UI层     │ │   状态管理   │ │      路由管理        │││
│  │  │  Components │ │    Vuex     │ │   Vue Router       │││
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    后端服务 (Node.js)                       │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────────────┐│
│  │    API层        │ │   业务逻辑   │ │      数据层          ││
│  │   Koa.js       │ │   Services   │ │     SQLite         ││
│  │   Routes       │ │   Utils      │ │     FileSystem     ││
│  └─────────────────┘ └─────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼ SSH/SFTP
┌─────────────────────────────────────────────────────────────┐
│                    外部系统集成                              │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────────────┐│
│  │   SSH服务器      │ │   AI服务     │ │    文件系统          ││
│  │   Linux/Unix    │ │   OpenAI    │ │    本地/远程        ││
│  │   Windows       │ │   Ollama    │ │                    ││
│  └─────────────────┘ └─────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

### 前端技术栈
- **框架**: Vue 3 (Composition API)
- **状态管理**: Vuex 4
- **路由**: Vue Router 4
- **UI库**: Element Plus
- **构建工具**: Vite
- **语言**: JavaScript (ES2020+)
- **样式**: SCSS + CSS变量

### 后端技术栈
- **运行时**: Node.js 16+
- **框架**: Koa.js 2
- **数据库**: SQLite 3
- **SSH客户端**: SSH2
- **加密**: Node.js Crypto
- **日志**: Winston
- **进程管理**: PM2 (生产环境)

### 桌面应用
- **框架**: Electron 22+
- **打包**: electron-builder
- **自动更新**: electron-updater
- **安全**: contextIsolation + preload

### 开发工具
- **代码质量**: ESLint + Prettier
- **测试**: Jest + Playwright
- **文档**: VitePress
- **CI/CD**: GitHub Actions

## 模块设计

### 1. 前端架构

#### 目录结构
```
src/frontend/
├── src/
│   ├── assets/           # 静态资源
│   │   ├── images/       # 图片资源
│   │   └── styles/       # 全局样式
│   ├── components/       # 通用组件
│   │   ├── common/       # 基础组件
│   │   ├── layout/       # 布局组件
│   │   └── business/     # 业务组件
│   ├── views/            # 页面组件
│   │   ├── connections/  # 连接管理
│   │   ├── files/        # 文件传输
│   │   ├── ai/           # AI助手
│   │   └── settings/     # 设置页面
│   ├── store/            # 状态管理
│   │   └── modules/      # 模块化状态
│   ├── router/           # 路由配置
│   ├── utils/            # 工具函数
│   └── main.js           # 应用入口
└── package.json
```

#### 状态管理设计

```javascript
// Store 模块结构
const store = {
  modules: {
    app: {
      state: { theme, language, settings },
      mutations: { ... },
      actions: { ... }
    },
    hosts: {
      state: { hosts, connections, activeHost },
      getters: { connectedHosts, hostsByGroup },
      mutations: { ... },
      actions: { connectHost, disconnectHost }
    },
    ai: {
      state: { conversations, models, config },
      mutations: { ... },
      actions: { sendMessage, loadHistory }
    },
    fileTransfer: {
      state: { transfers, currentDir },
      mutations: { ... },
      actions: { uploadFile, downloadFile }
    }
  }
}
```

#### 组件设计原则

1. **单一职责**: 每个组件只负责一个功能
2. **可复用性**: 通过props和slots实现组件复用
3. **响应式设计**: 支持不同屏幕尺寸
4. **无障碍访问**: 遵循ARIA标准
5. **性能优化**: 使用虚拟滚动、懒加载等

### 2. 后端架构

#### 分层设计

```
后端服务
├── 控制层 (Controllers)      # 处理HTTP请求
├── 业务逻辑层 (Services)     # 核心业务逻辑
├── 数据访问层 (DAL)          # 数据库操作
└── 工具层 (Utils)           # 通用工具函数
```

#### 核心服务模块

**SSH服务 (SSHService)**
```javascript
class SSHService {
  async connect(hostConfig)     // 建立SSH连接
  async disconnect(hostId)      // 断开连接
  async executeCommand()        // 执行命令
  getConnectionPool()           // 连接池管理
  getConnectionStats()          // 连接统计
}
```

**AI服务 (AIService)**
```javascript
class AIService {
  async sendMessage()           // 发送消息到AI
  async translateCommand()      // 命令转换
  async saveConversation()      // 保存对话历史
  validateConfig()              // 配置验证
}
```

**文件传输服务 (FileTransferService)**
```javascript
class FileTransferService {
  async uploadFile()            // 上传文件
  async downloadFile()          // 下载文件
  async listDirectory()         // 列出目录
  async transferWithProgress()  // 带进度的传输
}
```

**安全服务 (SecurityService)**
```javascript
class SecurityService {
  async auditCommand()          // 命令审核
  async checkPermissions()      // 权限检查
  async logOperation()          // 记录操作
  validateSecurityRules()       // 验证安全规则
}
```

### 3. 数据库设计

#### 表结构设计

```sql
-- 主机配置表
CREATE TABLE hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  auth_type TEXT CHECK(auth_type IN ('password', 'key')),
  encrypted_password TEXT,
  private_key_path TEXT,
  group_name TEXT,
  tags TEXT, -- JSON数组
  status TEXT DEFAULT 'disconnected',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI对话表
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  messages TEXT, -- JSON数组
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表
CREATE TABLE operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  username TEXT,
  hostname TEXT,
  description TEXT,
  result TEXT CHECK(result IN ('success', 'error', 'warning')),
  details TEXT, -- JSON对象
  client_ip TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 数据访问层

```javascript
class Database {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  // 通用查询方法
  async query(sql, params) { }
  async run(sql, params) { }
  async get(sql, params) { }

  // 事务支持
  async beginTransaction() { }
  async commitTransaction() { }
  async rollbackTransaction() { }

  // 业务方法
  async createHost(hostData) { }
  async updateHost(id, updates) { }
  async deleteHost(id) { }
  async getHostsByGroup(group) { }
}
```

### 4. 通信机制

#### 前后端通信

1. **HTTP API**: RESTful接口用于数据CRUD操作
2. **WebSocket**: 实时通信（终端输出、文件传输进度）
3. **IPC**: Electron主进程与渲染进程通信

#### API设计规范

```javascript
// RESTful API 设计
GET    /api/hosts           // 获取主机列表
POST   /api/hosts           // 创建主机
GET    /api/hosts/:id       // 获取单个主机
PUT    /api/hosts/:id       // 更新主机
DELETE /api/hosts/:id       // 删除主机

POST   /api/hosts/:id/connect    // 连接主机
POST   /api/hosts/:id/disconnect // 断开连接
POST   /api/hosts/:id/execute    // 执行命令

// WebSocket 消息格式
{
  type: 'terminal_output',
  hostId: 'host-123',
  data: 'command output...'
}
```

### 5. 安全架构

#### 数据安全

1. **本地加密**: 使用AES-256-GCM加密敏感数据
2. **密钥管理**: 基于设备硬件特征生成主密钥
3. **会话管理**: JWT token + 定期刷新机制

#### 网络安全

1. **HTTPS**: 所有外部通信使用HTTPS
2. **证书验证**: SSH主机密钥指纹验证
3. **代理支持**: 支持HTTP/SOCKS代理

#### 应用安全

1. **沙箱隔离**: Electron contextIsolation
2. **权限最小化**: 渲染进程无Node.js访问权限
3. **安全更新**: 自动更新机制防止漏洞

### 6. 性能优化

#### 前端优化

1. **代码分割**: 路由级别的懒加载
2. **虚拟滚动**: 大数据列表优化
3. **缓存策略**: HTTP缓存 + localStorage
4. **图片优化**: WebP格式 + 懒加载

#### 后端优化

1. **连接池**: SSH连接复用
2. **缓存层**: 内存缓存热点数据
3. **异步处理**: 非阻塞I/O操作
4. **性能监控**: 实时性能指标收集

### 7. 扩展性设计

#### 插件系统

```javascript
// 插件接口设计
class PluginInterface {
  onLoad() { }              // 插件加载
  onUnload() { }            // 插件卸载
  registerCommands() { }    // 注册命令
  registerViews() { }       // 注册视图
}

// 插件管理器
class PluginManager {
  loadPlugin(pluginPath) { }
  unloadPlugin(pluginId) { }
  getPluginList() { }
}
```

#### AI提供商扩展

```javascript
// AI提供商接口
class AIProvider {
  async sendMessage(message, config) { }
  async validateConfig(config) { }
  getSupportedModels() { }
}

// 支持的提供商
const providers = {
  openai: new OpenAIProvider(),
  ollama: new OllamaProvider(),
  claude: new ClaudeProvider()
};
```

## 部署架构

### 开发环境

```
开发机 (localhost)
├── 前端开发服务器 :5173
├── 后端API服务器 :3001
├── 数据库文件 ./data/dev.db
└── Electron主进程
```

### 生产环境

```
用户设备
├── Electron应用
│   ├── 前端资源 (打包后)
│   ├── 后端服务 (嵌入式)
│   └── SQLite数据库
└── 外部服务
    ├── SSH服务器
    ├── AI服务API
    └── 更新服务器
```

## 监控和日志

### 日志系统

```javascript
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});
```

### 性能监控

1. **应用性能**: CPU、内存使用率
2. **网络性能**: 连接延迟、吞吐量
3. **用户行为**: 功能使用统计
4. **错误监控**: 异常捕获和上报

## 总结

Temctl 的架构设计遵循以下核心原则：

1. **模块化**: 清晰的模块边界和职责分离
2. **可扩展**: 插件系统支持功能扩展
3. **安全性**: 多层次的安全防护机制
4. **性能**: 优化关键路径的性能表现
5. **用户体验**: 响应式设计和流畅的交互

这种设计确保了应用的稳定性、可维护性和扩展性，为用户提供高质量的跨平台终端管理体验。