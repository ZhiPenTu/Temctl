# 打包和部署指南

本文档详细说明如何构建、打包和部署 Temctl 应用到各个平台。

## 构建环境准备

### 通用要求
- Node.js 16+ 
- npm 8+
- Git
- Python 3.8+ (用于构建原生模块)

### Windows 构建环境
```powershell
# 安装 Windows Build Tools
npm install --global windows-build-tools

# 或使用 Visual Studio 2019/2022
# 需要包含 "使用 C++ 的桌面开发" 工作负载
```

### macOS 构建环境
```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 安装代码签名证书 (可选，用于分发)
# 需要 Apple Developer 账户
```

### Linux 构建环境
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential libnss3-dev libatk-bridge2.0-dev libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2-dev

# CentOS/RHEL/Fedora
sudo yum groupinstall "Development Tools"
sudo yum install nss-devel atk-devel libdrm-devel libXcomposite-devel libXdamage-devel libXrandr-devel libgbm-devel libXScrnSaver-devel alsa-lib-devel
```

## 本地构建

### 1. 克隆和安装依赖

```bash
# 克隆项目
git clone https://github.com/username/temctl.git
cd temctl

# 安装主项目依赖
npm install

# 安装子模块依赖
cd src/backend && npm install
cd ../frontend && npm install
cd ../..
```

### 2. 构建应用

```bash
# 构建前端
npm run build:frontend

# 构建后端
npm run build:backend

# 或者一键构建
npm run build
```

### 3. 开发模式运行

```bash
# 启动开发环境 (前端热重载 + 后端 + Electron)
npm run dev

# 或分别启动
npm run frontend:dev  # 前端开发服务器
npm run backend:dev   # 后端开发服务器
npm run electron:dev  # Electron 开发模式
```

## 跨平台打包

### 打包单个平台

```bash
# Windows
npm run dist:win

# macOS  
npm run dist:mac

# Linux
npm run dist:linux
```

### 打包所有平台

```bash
# 在任意平台构建所有平台的安装包
npm run electron:build:all
```

**注意**: 某些平台有限制：
- macOS 包只能在 macOS 上构建和签名
- Windows 包建议在 Windows 上构建以获得最佳兼容性

### 输出文件

构建完成后，安装包将生成在 `dist/` 目录：

```
dist/
├── Temctl Setup 1.0.0.exe          # Windows 安装程序
├── Temctl-1.0.0.dmg                # macOS 磁盘镜像  
├── Temctl-1.0.0.AppImage           # Linux AppImage
├── temctl_1.0.0_amd64.deb          # Debian 包
├── temctl-1.0.0.x86_64.rpm         # RPM 包
└── temctl_1.0.0_amd64.snap         # Snap 包
```

## 代码签名

### Windows 代码签名

```bash
# 设置证书环境变量
export WIN_CSC_LINK="path/to/certificate.p12"
export WIN_CSC_KEY_PASSWORD="certificate_password"

# 或在 package.json 中配置
"build": {
  "win": {
    "certificateFile": "path/to/certificate.p12",
    "certificatePassword": "password"
  }
}
```

### macOS 代码签名和公证

```bash
# 设置签名环境变量
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"

# 设置公证信息
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# 构建并自动签名
npm run dist:mac
```

## 持续集成/部署 (CI/CD)

### GitHub Actions

项目已配置 GitHub Actions 工作流 (`.github/workflows/build.yml`)，支持：

1. **自动测试**: 每次推送都运行测试
2. **多平台构建**: 自动在 Windows、macOS、Linux 上构建
3. **自动发布**: 推送标签时自动创建 GitHub Release

#### 配置密钥

在 GitHub 仓库设置中添加以下 Secrets：

```bash
# macOS 签名和公证
APPLE_ID                    # Apple ID
APPLE_ID_PASSWORD          # App专用密码
APPLE_TEAM_ID              # Apple Team ID
MAC_CERTIFICATE            # macOS 证书 (base64编码)
MAC_CERTIFICATE_PASSWORD   # 证书密码

# Windows 签名  
WINDOWS_CERTIFICATE        # Windows 证书 (base64编码)
WINDOWS_CERTIFICATE_PASSWORD # 证书密码

# GitHub Token (自动配置)
GITHUB_TOKEN              # 用于发布 Release
```

#### 触发构建

```bash
# 创建并推送标签触发发布
git tag v1.0.0
git push origin v1.0.0

# 或使用 GitHub Web 界面创建 Release
```

### 其他CI平台

#### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm ci
    - npm test

build:windows:
  stage: build
  tags: [windows]
  script:
    - npm run dist:win
  artifacts:
    paths:
      - dist/

build:macos:
  stage: build
  tags: [macos]  
  script:
    - npm run dist:mac
  artifacts:
    paths:
      - dist/

build:linux:
  stage: build
  tags: [linux]
  script:
    - npm run dist:linux
  artifacts:
    paths:
      - dist/
```

## 分发渠道

### 1. GitHub Releases

最简单的分发方式，自动通过 GitHub Actions 发布：

- 用户可直接下载安装包
- 支持自动更新检查
- 提供下载统计

### 2. 应用商店

#### Microsoft Store

```bash
# 生成 MSIX 包
npm run electron:build:win -- --publish=never

# 手动提交到 Microsoft Store
# 或使用 Partner Center API 自动提交
```

#### Mac App Store

```bash
# 构建 MAS 版本
npm run electron:build:mac -- --publish=never

# 使用 Application Loader 或 Transporter 提交
```

#### Snap Store

```bash
# 构建 Snap 包
npm run electron:build:linux

# 发布到 Snap Store
snapcraft upload dist/*.snap
snapcraft release temctl <revision> stable
```

### 3. 包管理器

#### Homebrew (macOS)

创建 Formula:

```ruby
# Formula/temctl.rb
class Temctl < Formula
  desc "跨平台AI终端工具"
  homepage "https://temctl.com"
  url "https://github.com/username/temctl/releases/download/v1.0.0/Temctl-1.0.0.dmg"
  sha256 "sha256_hash"
  version "1.0.0"

  def install
    prefix.install Dir["*"]
  end
end
```

#### Chocolatey (Windows)

创建包定义:

```xml
<!-- temctl.nuspec -->
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>temctl</id>
    <version>1.0.0</version>
    <title>Temctl</title>
    <authors>Temctl Team</authors>
    <description>跨平台AI终端工具</description>
    <projectUrl>https://temctl.com</projectUrl>
    <packageSourceUrl>https://github.com/username/temctl</packageSourceUrl>
    <licenseUrl>https://raw.githubusercontent.com/username/temctl/main/LICENSE</licenseUrl>
    <tags>terminal ssh ai cross-platform</tags>
  </metadata>
  <files>
    <file src="tools\**" target="tools" />
  </files>
</package>
```

### 4. 企业分发

#### 自建分发服务器

```javascript
// 简单的更新服务器
const express = require('express');
const app = express();

app.get('/update/:platform/:version', (req, res) => {
  const { platform, version } = req.params;
  
  // 检查是否有新版本
  const latestVersion = getLatestVersion(platform);
  
  if (semver.gt(latestVersion, version)) {
    res.json({
      url: `https://releases.example.com/${platform}/${latestVersion}`,
      name: `Temctl ${latestVersion}`,
      notes: "New features and bug fixes",
      pub_date: new Date().toISOString()
    });
  } else {
    res.status(204).end();
  }
});

app.listen(3000);
```

## 自动更新

### 配置更新服务器

```javascript
// main.js 中的更新配置
const { autoUpdater } = require('electron-updater');

if (!isDev) {
  // 生产环境启用自动更新
  autoUpdater.checkForUpdatesAndNotify();
}

// 自定义更新服务器
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'username',
  repo: 'temctl'
});
```

### 更新策略

1. **自动静默更新**: 后台下载，重启时安装
2. **提示用户更新**: 弹窗询问是否更新
3. **强制更新**: 关键安全更新强制安装

## 性能优化

### 减小包体积

```javascript
// electron-builder 配置优化
"build": {
  "files": [
    "!**/{test,__tests__,tests,powered-test,example,examples}",
    "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
    "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
    "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
    "!**/{appveyor.yml,.travis.yml,circle.yml}",
    "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}"
  ]
}
```

### 分包策略

```javascript
// 按需加载大型依赖
const loadSSH2 = () => import('ssh2');
const loadAI = () => import('./ai-service');
```

## 故障排除

### 常见构建问题

1. **原生模块编译失败**
```bash
# 重新构建原生模块
npm rebuild

# 使用预编译版本
npm install --force
```

2. **权限问题** (macOS)
```bash
# 解决权限问题
sudo chown -R $(whoami) ~/.npm
```

3. **内存不足**
```bash
# 增加 Node.js 堆内存
export NODE_OPTIONS="--max-old-space-size=8192"
```

### 调试构建过程

```bash
# 启用详细日志
DEBUG=electron-builder npm run dist

# 保留构建目录
npm run pack  # 只打包不压缩，便于调试
```

## 安全考虑

### 构建环境安全

1. **使用专用构建机器**: 避免在开发机器上构建生产版本
2. **证书安全管理**: 使用安全的密钥管理服务
3. **依赖安全检查**: 定期检查依赖漏洞

### 发布安全

1. **校验和验证**: 提供 SHA256 校验和
2. **GPG签名**: 对发布文件进行GPG签名
3. **恶意软件扫描**: 提交到 VirusTotal 等服务检查

---

**提示**: 首次构建可能需要较长时间下载依赖和工具链，后续构建会更快。建议在良好的网络环境下进行首次构建。