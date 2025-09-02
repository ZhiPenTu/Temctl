-- Temctl 数据库初始化脚本
-- SQLite 数据库表结构定义

-- ================================
-- 主机分组表
-- ================================
CREATE TABLE IF NOT EXISTS host_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#409eff',
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES host_groups(id) ON DELETE CASCADE
);

-- 创建分组索引
CREATE INDEX IF NOT EXISTS idx_host_groups_parent_id ON host_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_host_groups_name ON host_groups(name);

-- ================================
-- 主机信息表
-- ================================
CREATE TABLE IF NOT EXISTS hosts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hostname TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    auth_type TEXT CHECK(auth_type IN ('password', 'key', '2fa')) NOT NULL DEFAULT 'password',
    encrypted_password TEXT, -- 加密存储的密码
    private_key_path TEXT,   -- 私钥文件路径
    public_key_fingerprint TEXT, -- 公钥指纹
    group_id TEXT,
    tags TEXT, -- JSON数组格式存储标签
    description TEXT,
    connection_timeout INTEGER DEFAULT 30,
    keep_alive_interval INTEGER DEFAULT 30,
    charset TEXT DEFAULT 'utf-8',
    terminal_type TEXT DEFAULT 'xterm-256color',
    status TEXT CHECK(status IN ('connected', 'disconnected', 'connecting', 'error')) DEFAULT 'disconnected',
    last_connected_at DATETIME,
    connection_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES host_groups(id) ON DELETE SET NULL
);

-- 创建主机索引
CREATE INDEX IF NOT EXISTS idx_hosts_hostname ON hosts(hostname);
CREATE INDEX IF NOT EXISTS idx_hosts_group_id ON hosts(group_id);
CREATE INDEX IF NOT EXISTS idx_hosts_status ON hosts(status);
CREATE INDEX IF NOT EXISTS idx_hosts_name ON hosts(name);

-- ================================
-- SSH连接会话表
-- ================================
CREATE TABLE IF NOT EXISTS ssh_sessions (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('active', 'inactive', 'terminated')) DEFAULT 'active',
    client_ip TEXT,
    user_agent TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);

-- 创建会话索引
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_host_id ON ssh_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_status ON ssh_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_token ON ssh_sessions(session_token);

-- ================================
-- 文件传输记录表
-- ================================
CREATE TABLE IF NOT EXISTS file_transfers (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('upload', 'download')) NOT NULL,
    protocol TEXT CHECK(protocol IN ('sftp', 'ftp', 'scp')) DEFAULT 'sftp',
    local_path TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    transferred_size INTEGER DEFAULT 0,
    transfer_speed REAL DEFAULT 0,
    status TEXT CHECK(status IN ('pending', 'transferring', 'completed', 'failed', 'paused', 'cancelled')) DEFAULT 'pending',
    error_message TEXT,
    checksum TEXT, -- 文件校验和
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);

-- 创建文件传输索引
CREATE INDEX IF NOT EXISTS idx_file_transfers_host_id ON file_transfers(host_id);
CREATE INDEX IF NOT EXISTS idx_file_transfers_status ON file_transfers(status);
CREATE INDEX IF NOT EXISTS idx_file_transfers_type ON file_transfers(type);
CREATE INDEX IF NOT EXISTS idx_file_transfers_created_at ON file_transfers(created_at);

-- ================================
-- AI对话会话表
-- ================================
CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    host_id TEXT, -- 可选，关联的主机
    title TEXT,
    provider TEXT CHECK(provider IN ('openai', 'local', 'claude', 'gemini')) DEFAULT 'openai',
    model TEXT NOT NULL,
    context TEXT, -- JSON格式存储会话上下文
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL
);

-- 创建AI会话索引
CREATE INDEX IF NOT EXISTS idx_ai_sessions_host_id ON ai_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_provider ON ai_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated_at ON ai_sessions(updated_at);

-- ================================
-- AI对话消息表
-- ================================
CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT, -- JSON格式存储额外元数据
    tokens_used INTEGER,
    response_time INTEGER, -- 响应时间(毫秒)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

-- 创建AI消息索引
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_role ON ai_messages(role);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- ================================
-- 安全规则表
-- ================================
CREATE TABLE IF NOT EXISTS security_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('blacklist', 'whitelist', 'pattern', 'custom')) NOT NULL,
    rule_content TEXT NOT NULL, -- 规则内容，可以是命令、正则表达式等
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    action TEXT CHECK(action IN ('block', 'warn', 'log')) DEFAULT 'warn',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建安全规则索引
CREATE INDEX IF NOT EXISTS idx_security_rules_type ON security_rules(type);
CREATE INDEX IF NOT EXISTS idx_security_rules_enabled ON security_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_security_rules_severity ON security_rules(severity);

-- ================================
-- 审计日志表
-- ================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- 用户ID，暂时可为空
    host_id TEXT,
    session_id TEXT,
    action TEXT NOT NULL, -- 操作类型
    category TEXT CHECK(category IN ('ssh', 'ftp', 'ai', 'security', 'system')) NOT NULL,
    command TEXT, -- 执行的命令
    result TEXT, -- 执行结果
    status TEXT CHECK(status IN ('success', 'failed', 'blocked', 'warning')) NOT NULL,
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- JSON格式存储额外信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES ssh_sessions(id) ON DELETE SET NULL
);

-- 创建审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_host_id ON audit_logs(host_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ================================
-- 系统设置表
-- ================================
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL, -- 设置分类
    key TEXT NOT NULL, -- 设置键
    value TEXT, -- 设置值
    type TEXT CHECK(type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false, -- 是否加密存储
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, key)
);

-- 创建系统设置索引
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- ================================
-- 用户表 (为后续扩展预留)
-- ================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT CHECK(role IN ('admin', 'user', 'viewer')) DEFAULT 'user',
    status TEXT CHECK(status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
    last_login_at DATETIME,
    login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ================================
-- 插入默认数据
-- ================================

-- 插入默认主机分组
INSERT OR IGNORE INTO host_groups (id, name, description, color) VALUES 
('default', '默认分组', '系统默认主机分组', '#409eff'),
('production', '生产环境', '生产环境服务器', '#f56c6c'),
('development', '开发环境', '开发测试服务器', '#67c23a'),
('testing', '测试环境', '测试环境服务器', '#e6a23c');

-- 插入默认安全规则
INSERT OR IGNORE INTO security_rules (id, name, type, rule_content, description, severity, action) VALUES 
('rule_001', '禁止删除根目录', 'blacklist', 'rm -rf /', '禁止执行删除根目录的危险命令', 'critical', 'block'),
('rule_002', '禁止格式化磁盘', 'pattern', '^(mkfs|fdisk|parted).*', '禁止执行磁盘格式化命令', 'critical', 'block'),
('rule_003', '禁止修改关键系统文件', 'pattern', '^(rm|mv|cp).*(/etc/passwd|/etc/shadow|/etc/sudoers)', '禁止修改关键系统文件', 'high', 'block'),
('rule_004', '监控sudo使用', 'pattern', '^sudo.*', '监控sudo命令使用', 'medium', 'log'),
('rule_005', '监控网络配置修改', 'pattern', '^(iptables|ufw|firewall-cmd).*', '监控防火墙和网络配置修改', 'high', 'warn');

-- 插入默认系统设置
INSERT OR IGNORE INTO system_settings (id, category, key, value, type, description) VALUES 
('set_001', 'general', 'app_name', 'Temctl', 'string', '应用程序名称'),
('set_002', 'general', 'app_version', '1.0.0', 'string', '应用程序版本'),
('set_003', 'security', 'session_timeout', '30', 'number', '会话超时时间(分钟)'),
('set_004', 'security', 'max_login_attempts', '5', 'number', '最大登录尝试次数'),
('set_005', 'security', 'audit_log_retention', '90', 'number', '审计日志保留天数'),
('set_006', 'ai', 'default_provider', 'openai', 'string', '默认AI提供商'),
('set_007', 'ai', 'default_model', 'gpt-3.5-turbo', 'string', '默认AI模型'),
('set_008', 'ssh', 'connection_timeout', '30', 'number', 'SSH连接超时时间(秒)'),
('set_009', 'ssh', 'keep_alive_interval', '30', 'number', 'SSH保活间隔(秒)'),
('set_010', 'ftp', 'max_transfer_speed', '0', 'number', '最大传输速度限制(KB/s, 0表示无限制)');

-- ================================
-- 创建触发器用于自动更新时间戳
-- ================================

-- 主机分组更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_host_groups_timestamp 
AFTER UPDATE ON host_groups
BEGIN
    UPDATE host_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 主机信息更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_hosts_timestamp 
AFTER UPDATE ON hosts
BEGIN
    UPDATE hosts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- AI会话更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_ai_sessions_timestamp 
AFTER UPDATE ON ai_sessions
BEGIN
    UPDATE ai_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 安全规则更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_security_rules_timestamp 
AFTER UPDATE ON security_rules
BEGIN
    UPDATE security_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 系统设置更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_system_settings_timestamp 
AFTER UPDATE ON system_settings
BEGIN
    UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 用户更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;