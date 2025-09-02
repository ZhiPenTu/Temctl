# Temctl - 跨平台AI终端工具

<div align="center">
  <img src="docs/images/logo.png" alt="Temctl Logo" width="200" height="200">
  
  <p><strong>现代化的跨平台SSH终端管理工具，集成AI助手功能</strong></p>

  ![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Platform](https://img.shields.io/badge/platform-Windows%20|%20macOS%20|%20Linux-lightgrey.svg)
</div>

## ✨ 特性

### 🖥️ 跨平台支持
- **Windows 10/11**: 完整支持，包括WSL集成
- **macOS**: 原生应用体验，支持触控板手势
- **Linux**: 支持主流发行版（Ubuntu、CentOS、Debian等）

### 🔗 多终端管理
- **SSH资产管理**: 集中管理所有SSH连接配置
- **多种认证方式**: 支持密码认证和SSH密钥认证
- **主机分组管理**: 按项目、环境等维度组织主机
- **标签系统**: 灵活的主机标记和分类
- **连接状态监控**: 实时显示连接状态和健康度

### 📁 文件传输
- **多协议支持**: SFTP、SCP、FTP协议支持
- **断点续传**: 大文件传输中断后可续传
- **拖拽上传**: 直观的文件拖拽操作
- **进度监控**: 实时显示传输进度和速度
- **批量操作**: 支持批量上传下载

### 🤖 AI智能助手
- **自然语言交互**: 用自然语言描述需求
- **命令转换**: 自动将描述转换为终端命令
- **多AI模型支持**:
  - OpenAI GPT-3.5/GPT-4
  - 本地模型（Ollama）
  - Claude、Gemini等
- **上下文理解**: 基于当前环境提供精确建议
- **学习能力**: 记住用户偏好和常用命令

### 🛡️ 安全管控
- **命令审核**: 预设危险命令拦截规则
- **权限管理**: 细粒度的用户权限控制
- **操作审计**: 完整的操作日志记录
- **加密存储**: 本地密码和密钥安全加密存储
- **会话管理**: 自动超时和安全退出机制

## 🚀 快速开始

### 系统要求

- **操作系统**: Windows 10+、macOS 10.14+、Linux
- **内存**: 最少4GB RAM（推荐8GB）
- **存储空间**: 500MB可用空间
- **网络**: 互联网连接（用于AI功能和更新）

### 安装方式

#### 方式一：下载预编译包
1. 访问 [Releases](https://github.com/username/temctl/releases) 页面
2. 下载对应平台的安装包
3. 运行安装程序完成安装

#### 方式二：包管理器安装

**Windows (Chocolatey)**
```powershell
choco install temctl
```

**macOS (Homebrew)**
```bash
brew install --cask temctl
```

**Linux (Snap)**
```bash
sudo snap install temctl
```

### 首次使用

1. **启动应用**: 双击桌面图标或从开始菜单启动
2. **基本设置**: 首次启动会引导进行基本配置
3. **添加主机**: 点击"新建连接"添加第一台SSH主机
4. **AI配置**: 在设置中配置AI服务（可选）

## 📖 用户手册

### 主机连接管理

#### 新建SSH连接
1. 点击主界面的"新建连接"按钮
2. 填写连接信息：
   - **连接名称**: 便于识别的名称
   - **主机地址**: IP地址或域名
   - **端口**: SSH端口（默认22）
   - **用户名**: SSH用户名
3. 选择认证方式：
   - **密码认证**: 输入SSH密码
   - **密钥认证**: 选择私钥文件路径
4. 配置高级选项（可选）：
   - 主机分组
   - 连接超时设置
   - 保持连接选项
5. 点击"测试连接"验证配置
6. 点击"保存"完成创建

#### 连接到主机
- **单击连接**: 在主机列表中单击主机名
- **快速连接**: 使用快捷键 `Ctrl+N`（Windows/Linux）或 `Cmd+N`（macOS）
- **分组连接**: 选择分组后批量连接

#### 终端操作
- **多标签页**: 支持同时打开多个SSH会话
- **分屏显示**: 可水平或垂直分割终端窗口
- **会话保持**: 连接断开后自动重连
- **历史记录**: 保存命令执行历史

### 文件传输功能

#### 上传文件
1. 建立SSH连接后，点击"文件传输"
2. 在本地文件浏览器中选择文件
3. 拖拽文件到远程目录或点击"上传"按钮
4. 监控传输进度

#### 下载文件
1. 在远程文件浏览器中选择文件
2. 右键选择"下载"或拖拽到本地目录
3. 选择本地保存路径
4. 开始下载并监控进度

#### 文件管理
- **创建目录**: 右键菜单选择"新建文件夹"
- **删除文件**: 选择文件后按Delete键或右键删除
- **重命名**: F2键或右键菜单重命名
- **权限管理**: 右键属性设置文件权限

### AI助手使用

#### 基础对话
1. 点击"AI助手"进入对话界面
2. 在输入框中描述你的需求，例如：
   - "帮我查看系统负载"
   - "如何安装Docker"
   - "清理日志文件"
3. AI将提供相应的命令和解释

#### 命令转换
1. 使用自然语言描述操作需求
2. AI自动生成对应的终端命令
3. 可以直接执行或复制到终端

#### 配置AI服务
1. 进入"设置" > "AI配置"
2. 选择AI服务提供商：
   - **OpenAI**: 需要API Key
   - **本地模型**: 需要安装Ollama
3. 配置相关参数（API端点、模型选择等）

### 安全设置

#### 主密码保护
1. 进入"设置" > "安全设置"
2. 启用"主密码保护"
3. 设置主密码，用于保护敏感数据访问

#### 命令审核规则
1. 进入"安全审计"页面
2. 配置危险命令拦截规则
3. 设置审核策略（严格、普通、宽松）

#### 操作日志
- 所有操作自动记录到审计日志
- 支持按时间、用户、操作类型筛选
- 可导出日志用于合规审计

## 🔧 开发文档

详细的开发文档请参考：
- [开发环境搭建](docs/development/setup.md)
- [架构设计](docs/development/architecture.md)
- [API文档](docs/development/api.md)
- [贡献指南](docs/development/contributing.md)

## 🐛 问题反馈

### 常见问题
查看 [FAQ](docs/faq.md) 获取常见问题的解决方案。

### 报告问题
如果遇到问题，请通过以下方式反馈：
1. [GitHub Issues](https://github.com/username/temctl/issues)
2. 邮箱: support@temctl.com
3. QQ群: 123456789

### 功能建议
欢迎提出功能建议和改进意见，可通过：
1. GitHub Issues（功能请求模板）
2. 社区讨论区
3. 用户调研问卷

## 🤝 贡献

我们欢迎社区贡献！请阅读 [贡献指南](CONTRIBUTING.md) 了解如何参与项目开发。

### 贡献方式
- 🐛 报告Bug
- 💡 提出新功能
- 📝 改进文档
- 🔧 提交代码
- 🌍 本地化翻译

## 📄 许可证

本项目采用 [MIT许可证](LICENSE)。

## 🙏 致谢

感谢以下开源项目：
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 前端框架
- [SSH2](https://github.com/mscdex/ssh2) - SSH客户端库
- [Element Plus](https://element-plus.org/) - UI组件库

## 📞 联系我们

- **官网**: https://temctl.com
- **文档**: https://docs.temctl.com
- **邮箱**: hello@temctl.com
- **社区**: https://community.temctl.com

---

<div align="center">
  <p>如果这个项目对你有帮助，请给我们一个⭐️</p>
  <p>Made with ❤️ by Temctl Team</p>
</div>