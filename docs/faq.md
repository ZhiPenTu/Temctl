# 常见问题 (FAQ)

本文档收集了用户在使用 Temctl 过程中经常遇到的问题及其解决方案。

## 安装和启动

### Q: 安装后无法启动应用？
**A:** 请按以下步骤排查：

1. **检查系统要求**
   - Windows: 需要 Windows 10 或更高版本
   - macOS: 需要 macOS 10.14 或更高版本
   - Linux: 需要较新的发行版，确保有桌面环境

2. **权限问题**
   ```bash
   # Linux/macOS 需要执行权限
   chmod +x temctl
   ```

3. **依赖缺失**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install libgtk-3-0 libxss1 libasound2

   # CentOS/RHEL
   sudo yum install gtk3 libXScrnSaver alsa-lib
   ```

### Q: Windows Defender 报毒怎么办？
**A:** 这是误报，因为应用是新发布的。解决方法：
1. 将 Temctl 添加到 Windows Defender 白名单
2. 下载官方签名版本（即将发布）
3. 从源代码编译安装

### Q: macOS 提示"来自身份不明开发者"？
**A:** 
```bash
# 方法1：临时允许
sudo xattr -rd com.apple.quarantine /Applications/Temctl.app

# 方法2：系统偏好设置
# 系统偏好设置 -> 安全性与隐私 -> 通用 -> 仍要打开
```

## 连接问题

### Q: SSH连接超时或失败？
**A:** 请检查以下项目：

1. **网络连接**
   ```bash
   # 测试网络连通性
   ping your-server-ip
   telnet your-server-ip 22
   ```

2. **防火墙设置**
   - 检查本地防火墙
   - 检查服务器防火墙
   - 检查云服务器安全组设置

3. **SSH服务状态**
   ```bash
   # 在服务器上检查SSH服务
   systemctl status sshd
   sudo systemctl start sshd
   ```

4. **认证问题**
   - 验证用户名密码正确
   - 检查SSH密钥路径和权限
   - 确认服务器允许密码/密钥登录

### Q: 连接成功但无法执行命令？
**A:** 可能的原因：

1. **用户权限不足**
   ```bash
   # 检查用户权限
   whoami
   groups
   sudo -l
   ```

2. **Shell环境问题**
   - 检查默认Shell设置
   - 确认环境变量正确加载

3. **安全策略限制**
   - 检查服务器安全策略
   - 确认用户在允许的安全组中

### Q: 为什么有些主机连接很慢？
**A:** 优化建议：

1. **调整连接参数**
   - 增加连接超时时间
   - 启用连接复用
   - 使用压缩传输

2. **网络优化**
   - 使用就近的跳板机
   - 配置TCP加速
   - 检查MTU设置

## 文件传输

### Q: 文件上传失败或中断？
**A:** 解决方法：

1. **检查磁盘空间**
   ```bash
   # 服务器端
   df -h
   
   # 本地
   dir # Windows
   df -h # Linux/macOS
   ```

2. **文件权限问题**
   ```bash
   # 检查目录权限
   ls -la /target/directory
   
   # 修改权限（如果需要）
   chmod 755 /target/directory
   ```

3. **启用断点续传**
   - 在传输设置中启用断点续传功能
   - 检查临时文件是否存在

### Q: 传输速度很慢？
**A:** 优化建议：

1. **调整传输参数**
   - 增加并发连接数
   - 启用压缩传输
   - 调整缓冲区大小

2. **网络优化**
   - 检查带宽限制
   - 使用有线网络替代WiFi
   - 避免网络高峰期传输

## AI助手

### Q: AI助手无响应或报错？
**A:** 检查以下配置：

1. **API配置**
   ```javascript
   // 检查API密钥是否正确
   // 设置 -> AI配置 -> API Key
   ```

2. **网络连接**
   - 确认可以访问AI服务端点
   - 检查代理设置
   - 验证防火墙规则

3. **配额限制**
   - 检查API使用配额
   - 确认账户余额充足

### Q: 本地AI模型无法使用？
**A:** Ollama配置检查：

1. **安装Ollama**
   ```bash
   # 下载并安装Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **启动服务**
   ```bash
   # 启动Ollama服务
   ollama serve
   ```

3. **下载模型**
   ```bash
   # 下载模型（例如llama2）
   ollama pull llama2
   ```

4. **配置Temctl**
   - 端点：http://localhost:11434
   - 模型：选择已下载的模型

## 性能问题

### Q: 应用运行缓慢或卡顿？
**A:** 性能优化：

1. **系统资源**
   - 关闭不必要的后台程序
   - 增加可用内存
   - 检查CPU使用率

2. **应用设置**
   - 减少同时连接数
   - 关闭不必要的动画效果
   - 清理历史记录和缓存

3. **数据库优化**
   ```bash
   # 清理应用数据（谨慎操作）
   # Windows: %APPDATA%/Temctl
   # macOS: ~/Library/Application Support/Temctl
   # Linux: ~/.config/Temctl
   ```

### Q: 内存占用过高？
**A:** 内存管理：

1. **重启应用**
   - 定期重启应用释放内存

2. **调整设置**
   - 减少历史记录保留量
   - 限制并发连接数
   - 关闭自动同步功能

## 安全问题

### Q: 如何确保连接安全？
**A:** 安全建议：

1. **使用密钥认证**
   ```bash
   # 生成SSH密钥对
   ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
   ```

2. **启用主密码保护**
   - 设置 -> 安全设置 -> 主密码保护

3. **定期更新**
   - 保持应用更新到最新版本
   - 定期更新SSH密钥

### Q: 密码丢失怎么办？
**A:** 密码恢复：

1. **主密码重置**
   - 删除配置文件（会丢失所有保存的数据）
   - 重新配置连接信息

2. **SSH密码找回**
   - 联系服务器管理员重置
   - 使用其他认证方式（密钥）

## 数据备份

### Q: 如何备份配置和数据？
**A:** 备份方法：

1. **导出配置**
   - 设置 -> 高级设置 -> 导出配置

2. **手动备份**
   ```bash
   # 备份数据目录
   # Windows
   xcopy "%APPDATA%\Temctl" "D:\Backup\Temctl" /E /I

   # macOS
   cp -R "~/Library/Application Support/Temctl" "~/Desktop/Temctl_Backup"

   # Linux
   cp -R "~/.config/Temctl" "~/Temctl_Backup"
   ```

### Q: 如何迁移到新设备？
**A:** 数据迁移：

1. **导出配置**
   - 在旧设备上导出所有配置

2. **传输文件**
   - 复制数据目录到新设备
   - 或使用导入功能

3. **重新配置**
   - 验证连接信息
   - 重新设置AI配置

## 故障排查

### Q: 如何收集日志用于问题报告？
**A:** 日志收集：

1. **应用日志**
   ```bash
   # 日志文件位置
   # Windows: %APPDATA%\Temctl\logs
   # macOS: ~/Library/Application Support/Temctl/logs
   # Linux: ~/.config/Temctl/logs
   ```

2. **启用调试模式**
   - 帮助 -> 调试模式
   - 重现问题
   - 收集详细日志

3. **系统信息**
   - 操作系统版本
   - 应用版本号
   - 错误截图

### Q: 重置应用到默认状态？
**A:** 完全重置：

1. **备份重要数据**（推荐）

2. **删除应用数据**
   ```bash
   # Windows
   rd /s "%APPDATA%\Temctl"

   # macOS
   rm -rf "~/Library/Application Support/Temctl"

   # Linux
   rm -rf "~/.config/Temctl"
   ```

3. **重新启动应用**

## 联系支持

如果以上解决方案都无法解决你的问题，请通过以下方式联系我们：

- **GitHub Issues**: https://github.com/username/temctl/issues
- **邮箱**: support@temctl.com
- **社区**: https://community.temctl.com
- **QQ群**: 123456789

提交问题时，请包含：
1. 详细的问题描述
2. 重现步骤
3. 系统环境信息
4. 相关日志文件
5. 错误截图（如果有）

---

**提示**: 如果你的问题不在此列表中，可以在 GitHub 上搜索相似问题，或创建新的 Issue。我们会持续更新这个FAQ来帮助更多用户。