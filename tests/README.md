# Temctl 测试套件

本目录包含了 Temctl 应用的完整测试套件，包括单元测试、集成测试和端到端测试。

## 测试结构

```
tests/
├── backend/
│   ├── services/          # 后端服务单元测试
│   └── utils/             # 工具函数单元测试
├── frontend/
│   └── views/             # 前端组件单元测试
├── integration/           # 集成测试
├── e2e/                   # 端到端测试
├── setup.js              # 测试环境设置
├── package.json          # 测试依赖配置
├── playwright.config.js  # Playwright配置
└── README.md             # 测试文档

## 运行测试

### 安装依赖
```bash
cd tests
npm install
```

### 运行所有测试
```bash
npm test
```

### 运行特定类型的测试
```bash
# 后端单元测试
npm run test:backend

# 前端单元测试
npm run test:frontend

# 集成测试
npm run test:integration

# 端到端测试
npm run test:e2e
```

### 生成测试覆盖率报告
```bash
npm run test:coverage
```

## 测试覆盖的功能

### 后端测试
- SSH连接管理和连接池
- AI服务集成（OpenAI、本地模型）
- 数据库操作和事务处理
- 文件传输服务
- 安全审计和权限管理
- 缓存管理
- 性能监控

### 前端测试
- Vue组件渲染和交互
- Vuex状态管理
- 路由导航
- 用户界面响应式设计
- 组件间通信

### 集成测试
- API端点功能
- 前后端数据交互
- 错误处理和异常情况
- 安全性和CORS

### 端到端测试
- 完整的用户工作流程
- 跨浏览器兼容性
- 响应式布局验证
- 用户交互场景

## 测试最佳实践

1. **隔离性**: 每个测试都应该独立运行，不依赖其他测试的结果
2. **可重复性**: 测试结果应该一致和可预测
3. **速度**: 单元测试应该快速执行，集成测试可以稍慢
4. **覆盖率**: 目标覆盖率应该达到80%以上
5. **清理**: 测试后应该清理创建的资源和数据

## 持续集成

测试套件可以集成到CI/CD管道中：

```yaml
# GitHub Actions示例
- name: Run Tests
  run: |
    cd tests
    npm install
    npm test
    npm run test:e2e
```

## 故障排除

### 常见问题
1. **数据库锁定**: 确保测试使用内存数据库
2. **端口冲突**: 使用随机端口或确保端口可用
3. **异步操作**: 正确使用async/await处理异步测试
4. **模拟依赖**: 对外部服务进行适当的模拟

### 调试技巧
- 使用 `jest --verbose` 查看详细测试输出
- 使用 `playwright --debug` 调试E2E测试
- 查看测试覆盖率报告识别未测试的代码