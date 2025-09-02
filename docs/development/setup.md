# 开发环境搭建

本文档将指导你搭建 Temctl 的开发环境，包括前端、后端和桌面应用的完整开发环境。

## 前置要求

### 系统要求
- **操作系统**: Windows 10+、macOS 10.14+、或 Linux
- **Node.js**: 16.x 或更高版本
- **npm**: 8.x 或更高版本（或 yarn 1.22+）
- **Git**: 用于版本控制
- **Python**: 3.8+ （某些原生模块需要）

### 推荐工具
- **IDE**: Visual Studio Code
- **终端**: 支持现代终端特性的命令行工具
- **数据库工具**: SQLite Browser（用于查看数据库）

## 克隆项目

```bash
# 克隆仓库
git clone https://github.com/username/temctl.git
cd temctl

# 安装依赖
npm install
```

## 项目结构

```
temctl/
├── src/
│   ├── backend/              # 后端服务代码
│   │   ├── src/
│   │   │   ├── services/     # 业务服务层
│   │   │   ├── routes/       # API路由
│   │   │   ├── utils/        # 工具函数
│   │   │   └── app.js        # 应用入口
│   │   └── package.json      # 后端依赖
│   └── frontend/             # 前端代码
│       ├── src/
│       │   ├── views/        # 页面组件
│       │   ├── components/   # 通用组件
│       │   ├── store/        # Vuex状态管理
│       │   ├── router/       # 路由配置
│       │   └── main.js       # 前端入口
│       └── package.json      # 前端依赖
├── docs/                     # 文档
├── tests/                    # 测试代码
├── build/                    # 构建配置
└── package.json              # 主项目配置
```

## 后端开发环境

### 1. 安装后端依赖

```bash
cd src/backend
npm install
```

### 2. 环境配置

创建环境配置文件：

```bash
# 复制环境配置模板
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3001
HOST=localhost

# 数据库配置
DB_PATH=./data/temctl.db

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# AI服务配置（可选）
OPENAI_API_KEY=your_openai_api_key_here
OLLAMA_ENDPOINT=http://localhost:11434

# 安全配置
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

### 3. 数据库初始化

```bash
# 创建数据库目录
mkdir -p data

# 运行数据库初始化脚本
npm run db:init
```

### 4. 启动后端服务

```bash
# 开发模式（热重载）
npm run dev

# 或者普通启动
npm start
```

后端服务将在 `http://localhost:3001` 启动。

## 前端开发环境

### 1. 安装前端依赖

```bash
cd src/frontend
npm install
```

### 2. 启动开发服务器

```bash
# 启动 Vite 开发服务器
npm run dev
```

前端开发服务器将在 `http://localhost:5173` 启动。

### 3. 构建前端

```bash
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## Electron 开发环境

### 1. 安装 Electron 依赖

```bash
# 回到项目根目录
cd ../..
npm install
```

### 2. 启动 Electron 应用

```bash
# 开发模式启动 Electron
npm run electron:dev
```

这将：
1. 启动后端服务
2. 启动前端开发服务器
3. 启动 Electron 窗口

## 开发工作流

### 1. 代码风格

项目使用 ESLint 和 Prettier 确保代码风格一致：

```bash
# 检查代码风格
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

### 2. 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch
```

### 3. 提交代码

项目使用 conventional commits 规范：

```bash
# 添加文件
git add .

# 提交（使用规范格式）
git commit -m "feat: add SSH connection pooling"

# 推送
git push origin feature-branch
```

提交消息格式：
- `feat:` 新功能
- `fix:` Bug修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建或辅助工具修改

## IDE 配置

### Visual Studio Code

推荐安装以下扩展：

```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "vue.volar",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

配置文件 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": [
    "src/frontend",
    "src/backend"
  ],
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## 调试配置

### 1. 后端调试

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/backend/src/app.js",
      "cwd": "${workspaceFolder}/src/backend",
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["--inspect"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 2. 前端调试

浏览器开发者工具或 Vue DevTools 扩展。

### 3. Electron 调试

```json
{
  "name": "Debug Electron Main",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/main.js",
  "runtimeArgs": ["--inspect=5858"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

## 常见问题

### 1. 端口冲突

如果默认端口被占用，可以修改配置：

```bash
# 修改后端端口
export PORT=3002

# 修改前端端口
export VITE_PORT=5174
```

### 2. 依赖安装问题

清理并重新安装：

```bash
# 清理 node_modules
rm -rf node_modules src/*/node_modules

# 清理 package-lock.json
rm package-lock.json src/*/package-lock.json

# 重新安装
npm install
cd src/backend && npm install
cd ../frontend && npm install
```

### 3. SQLite 问题

如果遇到 SQLite 相关错误：

```bash
# 重建 SQLite 模块
npm rebuild sqlite3

# 或者使用预编译版本
npm install sqlite3 --build-from-source=false
```

### 4. Electron 启动问题

```bash
# 重建 Electron
npm run electron:rebuild

# 或者清理缓存
npm run electron:clean
```

## 性能优化

### 开发模式优化

1. **使用 SSD**: 将项目放在 SSD 上可显著提升构建速度
2. **增加内存**: Node.js 可能需要更多内存处理大型项目
3. **排除文件**: 在杀毒软件中排除项目目录
4. **使用 pnpm**: 考虑使用 pnpm 替代 npm 以获得更快的安装速度

### 构建优化

```bash
# 使用并行构建
npm run build -- --parallel

# 启用缓存
npm run build -- --cache
```

## 下一步

环境搭建完成后，建议阅读：
- [架构设计文档](architecture.md)
- [API接口文档](api.md)
- [贡献指南](contributing.md)

如果遇到问题，请查看 [常见问题](../faq.md) 或在 GitHub 上提出 issue。