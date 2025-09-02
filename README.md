# Temctl - 跨平台AI终端工具

## 项目简介

Temctl是一款跨平台的AI终端工具，集成了SSH资产管理、文件传输、AI交互和安全管控等功能，为系统管理员和运维工程师提供智能化的远程主机管理体验。

## 核心功能

### 🖥️ 跨平台支持
- ✅ macOS
- ✅ Windows  
- ✅ Linux

### 🔗 多终端管理
- SSH资产管理
- 主机分组和标签管理
- 密码和密钥认证
- 连接状态监控

### 📁 文件传输
- FTP/SFTP协议支持
- 断点续传
- 大文件传输
- 传输队列管理

### 🤖 AI交互
- 内置AI对话系统
- 自然语言到命令转换
- OpenAI API支持
- 本地大模型支持

### 🔒 安全管控
- 命令执行审核
- 操作审计日志
- 权限管理
- 本地加密存储

## 技术架构

### 前端技术栈
- **应用框架**: Electron
- **UI框架**: Vue 3
- **状态管理**: Vuex
- **UI组件**: Element Plus
- **样式**: SCSS

### 后端技术栈
- **运行时**: Node.js
- **Web框架**: Koa.js
- **数据库**: SQLite
- **SSH客户端**: ssh2
- **加密**: crypto-js
- **日志**: winston

## 项目结构

```
temctl/
├── src/
│   ├── main/              # Electron主进程
│   ├── frontend/          # Vue前端应用
│   └── backend/           # Koa.js后端服务
├── docs/                  # 项目文档
├── tests/                 # 测试文件
└── scripts/               # 构建脚本
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建应用
```bash
npm run build
```

### 打包分发
```bash
npm run pack:all
```

## 开发指南

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交变更
4. 创建Pull Request

## 安全须知

- 所有敏感信息（密码、密钥）仅在本地存储
- 采用AES-256加密保护敏感数据
- 不会通过互联网传输认证信息
- 支持企业级安全管控策略

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献指南

欢迎贡献代码！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

## 联系我们

- GitHub: [ZhiPenTu/Temctl](https://github.com/ZhiPenTu/Temctl)
- Issues: [项目Issues](https://github.com/ZhiPenTu/Temctl/issues)

---

**注意**: 本工具处于积极开发中，功能和API可能会发生变化。生产环境使用前请充分测试。