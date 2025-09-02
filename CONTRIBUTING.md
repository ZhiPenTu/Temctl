# 贡献指南

感谢您考虑为Temctl项目做出贡献！本指南将帮助您了解如何参与项目开发。

## 开发环境设置

### 前置要求
- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### 克隆项目
```bash
git clone https://github.com/ZhiPenTu/Temctl.git
cd Temctl
npm install
```

### 开发模式运行
```bash
npm run dev
```

## 代码规范

### JavaScript代码规范
- 使用2个空格缩进
- 使用单引号字符串
- 函数名使用camelCase
- 类名使用PascalCase
- 常量使用UPPER_SNAKE_CASE

### Vue组件规范
- 组件文件名使用PascalCase
- 组件template使用2个空格缩进
- props定义要包含类型和默认值
- 使用Composition API风格

### 提交信息规范
```
type(scope): description

types:
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建工具或辅助工具的变动

例如:
feat(ssh): 添加SSH密钥认证功能
fix(ui): 修复主机列表显示问题
docs(readme): 更新安装说明
```

## 分支策略

- `main`: 主分支，保持稳定版本
- `develop`: 开发分支，集成新功能
- `feature/*`: 功能分支
- `bugfix/*`: 问题修复分支
- `hotfix/*`: 紧急修复分支

## 提交流程

1. Fork项目到您的GitHub账户
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交代码：`git commit -m "feat: your feature description"`
4. 推送到您的分支：`git push origin feature/your-feature`
5. 创建Pull Request

## Pull Request要求

### 标题格式
```
[类型] 简短描述
```

### 描述模板
```markdown
## 变更描述
简要描述本次变更的内容和目的

## 变更类型
- [ ] 新功能
- [ ] Bug修复
- [ ] 文档更新
- [ ] 性能优化
- [ ] 代码重构
- [ ] 其他

## 测试
- [ ] 已添加单元测试
- [ ] 已通过现有测试
- [ ] 已进行手动测试

## 影响范围
描述此次变更可能影响的功能模块

## 截图/录屏
如果是UI相关变更，请提供截图或录屏

## 检查清单
- [ ] 代码符合项目规范
- [ ] 已更新相关文档
- [ ] 已测试在各平台的兼容性
- [ ] 没有引入安全风险
```

## 问题报告

### Bug报告模板
```markdown
## Bug描述
简要描述遇到的问题

## 复现步骤
1. 第一步
2. 第二步
3. ...

## 期望行为
描述您期望发生的行为

## 实际行为
描述实际发生的行为

## 环境信息
- 操作系统: (例如 macOS 12.0)
- Node.js版本: (例如 16.14.0)
- 应用版本: (例如 1.0.0)

## 附加信息
任何其他有助于诊断问题的信息
```

### 功能请求模板
```markdown
## 功能描述
简要描述您希望添加的功能

## 使用场景
描述这个功能的使用场景和必要性

## 解决方案
描述您期望的解决方案

## 替代方案
描述您考虑过的替代解决方案

## 附加信息
任何其他相关信息
```

## 开发指南

### 目录结构
```
src/
├── main/                 # Electron主进程
│   ├── main.js          # 应用入口
│   ├── menu.js          # 应用菜单
│   └── window.js        # 窗口管理
├── frontend/            # Vue前端
│   ├── components/      # 组件
│   ├── views/          # 页面
│   ├── store/          # 状态管理
│   └── utils/          # 工具函数
└── backend/            # Koa后端
    ├── controllers/    # 控制器
    ├── services/      # 服务层
    ├── models/        # 数据模型
    └── middleware/    # 中间件
```

### 调试技巧
- 使用Chrome DevTools调试渲染进程
- 使用VS Code调试主进程
- 查看日志文件进行问题诊断

### 测试指南
- 单元测试使用Jest框架
- E2E测试使用Playwright
- 测试覆盖率要求达到80%以上

## 代码审查

所有Pull Request都需要经过代码审查：

1. 功能正确性验证
2. 代码质量检查
3. 安全性评估
4. 性能影响分析
5. 文档完整性检查

## 发布流程

1. 创建release分支
2. 更新版本号和CHANGELOG
3. 完成测试验证
4. 合并到main分支
5. 创建GitHub Release
6. 构建和发布应用包

## 联系方式

如果您有任何问题或建议，请通过以下方式联系我们：

- GitHub Issues: [项目Issues页面](https://github.com/ZhiPenTu/Temctl/issues)
- 邮件: [项目邮箱]

再次感谢您的贡献！