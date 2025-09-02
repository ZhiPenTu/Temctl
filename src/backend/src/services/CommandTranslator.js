const logger = require('../utils/logger');
const AIService = require('./AIService');

/**
 * 命令转换服务
 * 将自然语言转换为对应的终端命令
 */
class CommandTranslator {
  constructor() {
    // 常用命令模板
    this.commandTemplates = {
      // 文件操作
      'list_files': {
        patterns: ['列出文件', '查看文件', '显示文件', 'ls', 'list'],
        template: 'ls -la {path}',
        description: '列出目录中的文件'
      },
      'change_directory': {
        patterns: ['进入目录', '切换目录', 'cd', '转到'],
        template: 'cd {path}',
        description: '切换到指定目录'
      },
      'create_directory': {
        patterns: ['创建目录', '新建目录', 'mkdir', '建立文件夹'],
        template: 'mkdir -p {path}',
        description: '创建目录'
      },
      'remove_file': {
        patterns: ['删除文件', '移除文件', 'rm', '删掉'],
        template: 'rm {path}',
        description: '删除文件'
      },
      'copy_file': {
        patterns: ['复制文件', '拷贝文件', 'cp', '复制'],
        template: 'cp {source} {destination}',
        description: '复制文件'
      },
      'move_file': {
        patterns: ['移动文件', '重命名', 'mv', '移到'],
        template: 'mv {source} {destination}',
        description: '移动或重命名文件'
      },
      
      // 系统信息
      'show_processes': {
        patterns: ['查看进程', '显示进程', 'ps', '进程列表'],
        template: 'ps aux',
        description: '显示系统进程'
      },
      'disk_usage': {
        patterns: ['磁盘使用', '查看磁盘', 'df', '磁盘空间'],
        template: 'df -h',
        description: '显示磁盘使用情况'
      },
      'memory_usage': {
        patterns: ['内存使用', '查看内存', 'free', '内存情况'],
        template: 'free -h',
        description: '显示内存使用情况'
      },
      'system_info': {
        patterns: ['系统信息', '查看系统', 'uname', '系统版本'],
        template: 'uname -a',
        description: '显示系统信息'
      },
      
      // 网络操作
      'ping_host': {
        patterns: ['ping', '测试连通性', '网络测试'],
        template: 'ping -c 4 {host}',
        description: 'ping网络主机'
      },
      'check_port': {
        patterns: ['检查端口', '测试端口', 'telnet', '端口连通'],
        template: 'telnet {host} {port}',
        description: '测试端口连通性'
      },
      'network_status': {
        patterns: ['网络状态', '网络连接', 'netstat', '连接状态'],
        template: 'netstat -tuln',
        description: '显示网络连接状态'
      },
      
      // 文件内容操作
      'view_file': {
        patterns: ['查看文件内容', '显示文件', 'cat', '看文件'],
        template: 'cat {file}',
        description: '查看文件内容'
      },
      'tail_file': {
        patterns: ['查看日志', '尾部', 'tail', '最后几行'],
        template: 'tail -f {file}',
        description: '实时查看文件尾部'
      },
      'search_text': {
        patterns: ['搜索文本', '查找内容', 'grep', '搜索'],
        template: 'grep -r "{text}" {path}',
        description: '在文件中搜索文本'
      },
      
      // 压缩解压
      'extract_archive': {
        patterns: ['解压', '提取', 'tar', 'unzip'],
        template: 'tar -xzf {file}',
        description: '解压压缩文件'
      },
      'create_archive': {
        patterns: ['压缩', '打包', '创建压缩包'],
        template: 'tar -czf {archive} {path}',
        description: '创建压缩包'
      },
      
      // 权限操作
      'change_permission': {
        patterns: ['修改权限', '改权限', 'chmod', '权限设置'],
        template: 'chmod {mode} {file}',
        description: '修改文件权限'
      },
      'change_owner': {
        patterns: ['修改所有者', '改所有者', 'chown', '所有权'],
        template: 'chown {user}:{group} {file}',
        description: '修改文件所有者'
      }
    };
    
    // 安全检查规则
    this.securityRules = {
      dangerous: [
        'rm -rf /',
        'dd if=',
        'mkfs',
        'format',
        '> /dev/sda',
        'rm -rf *',
        'chmod 777 /',
        'chown root:root /',
        ':(){:|:&};:',  // fork炸弹
        'sudo rm',
        'sudo dd'
      ],
      restricted: [
        'sudo',
        'su',
        'passwd',
        'adduser',
        'userdel',
        'usermod',
        'mount',
        'umount',
        'fdisk',
        'parted'
      ]
    };
  }

  /**
   * 自然语言转换为命令
   */
  async translateToCommand(naturalLanguage, options = {}) {
    try {
      logger.info('开始命令转换:', naturalLanguage);
      
      // 首先尝试模板匹配
      const templateResult = this.matchTemplate(naturalLanguage);
      if (templateResult) {
        logger.info('模板匹配成功:', templateResult);
        return {
          success: true,
          command: templateResult.command,
          description: templateResult.description,
          method: 'template',
          confidence: templateResult.confidence
        };
      }
      
      // 如果模板匹配失败，使用AI转换
      const aiResult = await this.translateWithAI(naturalLanguage, options);
      if (aiResult) {
        logger.info('AI转换成功:', aiResult);
        return {
          success: true,
          command: aiResult.command,
          description: aiResult.description,
          method: 'ai',
          confidence: aiResult.confidence || 0.7
        };
      }
      
      return {
        success: false,
        error: '无法理解的命令描述',
        suggestions: this.getSuggestions(naturalLanguage)
      };
      
    } catch (error) {
      logger.error('命令转换失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 模板匹配
   */
  matchTemplate(input) {
    const normalizedInput = input.toLowerCase().trim();
    
    for (const [commandType, template] of Object.entries(this.commandTemplates)) {
      for (const pattern of template.patterns) {
        if (normalizedInput.includes(pattern.toLowerCase())) {
          // 提取参数
          const params = this.extractParameters(normalizedInput, template);
          const command = this.fillTemplate(template.template, params);
          
          return {
            command,
            description: template.description,
            confidence: 0.9,
            type: commandType,
            parameters: params
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 提取参数
   */
  extractParameters(input, template) {
    const params = {};
    
    // 提取路径参数
    const pathRegex = /(?:到|进入|在|查看|删除|复制|移动)\s*([^\s]+)|([/\w\-\.~]+)/g;
    const pathMatches = [...input.matchAll(pathRegex)];
    
    if (pathMatches.length > 0) {
      params.path = pathMatches[0][1] || pathMatches[0][2] || '.';
      
      if (pathMatches.length > 1) {
        params.source = pathMatches[0][1] || pathMatches[0][2];
        params.destination = pathMatches[1][1] || pathMatches[1][2];
      }
    }
    
    // 提取主机名
    const hostRegex = /ping\s+([^\s]+)|测试\s*([^\s]+)/g;
    const hostMatch = hostRegex.exec(input);
    if (hostMatch) {
      params.host = hostMatch[1] || hostMatch[2];
    }
    
    // 提取端口号
    const portRegex = /端口\s*(\d+)|:(\d+)/g;
    const portMatch = portRegex.exec(input);
    if (portMatch) {
      params.port = portMatch[1] || portMatch[2];
    }
    
    // 提取搜索文本
    const textRegex = /搜索\s*["""']([^"""']+)["""']|查找\s*["""']([^"""']+)["""']/g;
    const textMatch = textRegex.exec(input);
    if (textMatch) {
      params.text = textMatch[1] || textMatch[2];
    }
    
    // 提取权限模式
    const modeRegex = /权限\s*(\d+)/g;
    const modeMatch = modeRegex.exec(input);
    if (modeMatch) {
      params.mode = modeMatch[1];
    }
    
    return params;
  }

  /**
   * 填充模板
   */
  fillTemplate(template, params) {
    let command = template;
    
    // 替换参数占位符
    Object.keys(params).forEach(key => {
      const placeholder = `{${key}}`;
      if (command.includes(placeholder)) {
        command = command.replace(placeholder, params[key]);
      }
    });
    
    // 清理未填充的占位符
    command = command.replace(/{[^}]+}/g, '');
    
    return command.trim();
  }

  /**
   * 使用AI进行命令转换
   */
  async translateWithAI(naturalLanguage, options = {}) {
    try {
      const systemPrompt = `你是一个Linux/Unix命令转换助手。将自然语言描述转换为相应的终端命令。

规则:
1. 只返回单个命令，不要解释
2. 使用常用的命令和参数
3. 确保命令安全，避免危险操作
4. 如果涉及文件路径，使用相对路径
5. 响应格式: {"command": "具体命令", "description": "命令描述"}

示例:
输入: "查看当前目录文件"
输出: {"command": "ls -la", "description": "列出当前目录详细信息"}

输入: "删除临时文件"
输出: {"command": "rm temp*", "description": "删除以temp开头的文件"}`;

      const response = await AIService.chat(naturalLanguage, {
        systemPrompt,
        model: options.model || 'gpt-3.5-turbo',
        provider: options.provider || 'openai',
        temperature: 0.1 // 降低随机性
      });
      
      if (response && response.content) {
        try {
          const result = JSON.parse(response.content);
          
          // 安全检查
          if (!this.isCommandSafe(result.command)) {
            return {
              success: false,
              error: '命令被安全策略阻止',
              command: result.command
            };
          }
          
          return {
            command: result.command,
            description: result.description,
            confidence: 0.8
          };
        } catch (parseError) {
          logger.error('AI响应解析失败:', parseError);
          return null;
        }
      }
      
      return null;
      
    } catch (error) {
      logger.error('AI命令转换失败:', error);
      return null;
    }
  }

  /**
   * 命令安全检查
   */
  isCommandSafe(command) {
    if (!command || typeof command !== 'string') {
      return false;
    }
    
    const normalizedCommand = command.toLowerCase().trim();
    
    // 检查危险命令
    for (const dangerous of this.securityRules.dangerous) {
      if (normalizedCommand.includes(dangerous.toLowerCase())) {
        logger.warn('检测到危险命令:', command);
        return false;
      }
    }
    
    // 检查受限命令 (可以通过配置允许)
    for (const restricted of this.securityRules.restricted) {
      if (normalizedCommand.startsWith(restricted.toLowerCase())) {
        logger.warn('检测到受限命令:', command);
        // 这里可以根据用户权限配置决定是否允许
        return false;
      }
    }
    
    return true;
  }

  /**
   * 获取建议
   */
  getSuggestions(input) {
    const suggestions = [];
    
    // 基于输入关键词提供建议
    const keywords = input.toLowerCase().split(/\s+/);
    
    for (const [commandType, template] of Object.entries(this.commandTemplates)) {
      for (const pattern of template.patterns) {
        if (keywords.some(keyword => pattern.toLowerCase().includes(keyword))) {
          suggestions.push({
            command: template.template,
            description: template.description,
            example: this.getCommandExample(commandType)
          });
        }
      }
    }
    
    return suggestions.slice(0, 5); // 最多返回5个建议
  }

  /**
   * 获取命令示例
   */
  getCommandExample(commandType) {
    const examples = {
      'list_files': 'ls -la /home/user',
      'change_directory': 'cd /var/log',
      'create_directory': 'mkdir -p /tmp/test',
      'view_file': 'cat /etc/hosts',
      'search_text': 'grep -r "error" /var/log',
      'ping_host': 'ping -c 4 google.com',
      'disk_usage': 'df -h',
      'show_processes': 'ps aux | grep nginx'
    };
    
    return examples[commandType] || '';
  }

  /**
   * 获取支持的命令类型
   */
  getSupportedCommands() {
    return Object.keys(this.commandTemplates).map(type => ({
      type,
      description: this.commandTemplates[type].description,
      patterns: this.commandTemplates[type].patterns,
      example: this.getCommandExample(type)
    }));
  }

  /**
   * 验证命令语法
   */
  validateCommand(command) {
    if (!command || typeof command !== 'string') {
      return { valid: false, error: '命令不能为空' };
    }
    
    // 基本语法检查
    const trimmed = command.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: '命令不能为空' };
    }
    
    // 检查是否包含危险字符组合
    if (trimmed.includes('&&') && trimmed.includes('rm')) {
      return { valid: false, error: '命令包含潜在危险操作' };
    }
    
    // 安全检查
    if (!this.isCommandSafe(command)) {
      return { valid: false, error: '命令被安全策略阻止' };
    }
    
    return { valid: true };
  }
}

module.exports = new CommandTranslator();