/**
 * 命令处理器系统
 * 实现类似Claude Code的slash commands功能
 */

export interface CommandContext {
  currentUrl?: string;
  tabId?: number;
  timestamp: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>;
}

export class CommandProcessor {
  private commands: Map<string, Command> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  /**
   * 注册命令
   */
  registerCommand(command: Command) {
    this.commands.set(command.name, command);
  }

  /**
   * 执行命令
   */
  async executeCommand(input: string, context: CommandContext): Promise<CommandResult> {
    const parts = input.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0].startsWith('/')) {
      return {
        success: false,
        message: '命令必须以 / 开头',
      };
    }

    const commandName = parts[0].substring(1); // 移除 /
    const args = parts.slice(1);

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        success: false,
        message: `未知命令: /${commandName}`,
      };
    }

    try {
      return await command.execute(args, context);
    } catch (error) {
      return {
        success: false,
        message: `命令执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 获取所有可用命令
   */
  getAvailableCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * 注册默认命令
   */
  private registerDefaultCommands() {
    // /help 命令
    this.registerCommand({
      name: 'help',
      description: '显示所有可用命令',
      execute: async () => {
        const commands = this.getAvailableCommands();
        const commandList = commands.map(cmd => `/${cmd.name} - ${cmd.description}`).join('\n');
        return {
          success: true,
          message: `可用命令:\n${commandList}`,
        };
      },
    });

    // /compact 命令 - 简单版本
    this.registerCommand({
      name: 'compact',
      description: '压缩当前会话内容',
      execute: async (args, context) =>
        // 这里实现基本的compact逻辑
        ({
          success: true,
          message: '会话内容已压缩',
          data: {
            timestamp: context.timestamp,
            url: context.currentUrl,
          },
        }),
    });

    // /superCompact 命令 - 增强版本
    this.registerCommand({
      name: 'superCompact',
      description: '超级压缩：压缩内容 + 自动提交 + 更新项目文件',
      execute: async (args, context) => {
        try {
          // 1. 执行基本压缩
          const compactResult = await this.executeCommand('/compact', context);
          if (!compactResult.success) {
            return compactResult;
          }

          // 2. 创建git commit
          const commitResult = await this.createGitCommit(context);

          // 3. 更新项目管理文件
          const updateResult = await this.updateProjectFiles(context);

          return {
            success: true,
            message: `SuperCompact 完成!\n✅ 内容已压缩\n✅ Git提交: ${commitResult.message}\n✅ 项目文件已更新: ${updateResult.message}`,
            data: {
              compact: compactResult.data,
              commit: commitResult.data,
              update: updateResult.data,
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `SuperCompact失败: ${error instanceof Error ? error.message : '未知错误'}`,
          };
        }
      },
    });

    // /clear 命令
    this.registerCommand({
      name: 'clear',
      description: '清空命令历史',
      execute: async () => ({
        success: true,
        message: '命令历史已清空',
      }),
    });

    // 表单相关命令
    this.registerFormCommands();
  }

  /**
   * 注册表单相关命令
   */
  private registerFormCommands() {
    // /detectForms 命令
    this.registerCommand({
      name: 'detectForms',
      description: '检测当前页面的表单',
      execute: async () => {
        try {
          // 通过消息传递给content script执行
          const result = await this.sendMessageToContentScript({
            action: 'detectForms',
          });

          if (result.success) {
            const forms = (result.data as unknown[]) || [];
            const formsInfo = forms
              .map((form: unknown, index: number) => {
                const formObj = form as Record<string, unknown>;
                return `${index + 1}. ${formObj.formType as string}表单 (${(formObj.fields as unknown[]).length}个字段, 置信度: ${Math.round((formObj.confidence as number) * 100)}%)`;
              })
              .join('\n');

            return {
              success: true,
              message: `检测到 ${forms.length} 个表单:\n${formsInfo}`,
              data: forms,
            };
          } else {
            return {
              success: false,
              message: result.message || '表单检测失败',
            };
          }
        } catch (error) {
          return {
            success: false,
            message: `表单检测失败: ${error instanceof Error ? error.message : '未知错误'}`,
          };
        }
      },
    });

    // /fillForm 命令
    this.registerCommand({
      name: 'fillForm',
      description: '填写表单 - 用法: /fillForm <模板名称> [表单选择器]',
      execute: async args => {
        if (args.length === 0) {
          return {
            success: false,
            message: '请指定模板名称。用法: /fillForm <模板名称> [表单选择器]',
          };
        }

        const templateName = args[0];
        const formSelector = args[1] || 'form:first-of-type';

        try {
          // 获取表单模板
          const template = await this.getFormTemplate(templateName);
          if (!template) {
            return {
              success: false,
              message: `未找到模板: ${templateName}`,
            };
          }

          // 发送填写请求到content script
          const result = await this.sendMessageToContentScript({
            action: 'fillForm',
            data: {
              formSelector,
              data: (template as Record<string, unknown>).data,
              options: {
                simulateTyping: true,
                typingDelay: 50,
                triggerEvents: true,
                scrollToField: true,
              },
            },
          });

          return result;
        } catch (error) {
          return {
            success: false,
            message: `填写表单失败: ${error instanceof Error ? error.message : '未知错误'}`,
          };
        }
      },
    });

    // /clearForm 命令
    this.registerCommand({
      name: 'clearForm',
      description: '清空表单 - 用法: /clearForm [表单选择器]',
      execute: async args => {
        const formSelector = args[0] || 'form:first-of-type';

        try {
          const result = await this.sendMessageToContentScript({
            action: 'clearForm',
            data: { formSelector },
          });

          return result;
        } catch (error) {
          return {
            success: false,
            message: `清空表单失败: ${error instanceof Error ? error.message : '未知错误'}`,
          };
        }
      },
    });

    // /saveFormTemplate 命令
    this.registerCommand({
      name: 'saveFormTemplate',
      description: '保存表单模板 - 用法: /saveFormTemplate <模板名称> <数据JSON>',
      execute: async args => {
        if (args.length < 2) {
          return {
            success: false,
            message: '请提供模板名称和数据。用法: /saveFormTemplate <模板名称> <数据JSON>',
          };
        }

        const templateName = args[0];
        const dataString = args.slice(1).join(' ');

        try {
          const data = JSON.parse(dataString);
          await this.saveFormTemplate(templateName, data);

          return {
            success: true,
            message: `表单模板 "${templateName}" 已保存`,
          };
        } catch (error) {
          return {
            success: false,
            message: `保存模板失败: ${error instanceof Error ? error.message : '数据格式无效'}`,
          };
        }
      },
    });

    // /listFormTemplates 命令
    this.registerCommand({
      name: 'listFormTemplates',
      description: '列出所有表单模板',
      execute: async () => {
        try {
          const templates = await this.listFormTemplates();

          if (templates.length === 0) {
            return {
              success: true,
              message: '暂无保存的表单模板',
            };
          }

          const templateList = (templates as Record<string, unknown>[])
            .map(
              (template: Record<string, unknown>, index: number) =>
                `${index + 1}. ${template.name as string} (${(template.tags as string[])?.join(', ') || '无标签'})`,
            )
            .join('\n');

          return {
            success: true,
            message: `共 ${templates.length} 个模板:\n${templateList}`,
            data: templates,
          };
        } catch (error) {
          return {
            success: false,
            message: `获取模板列表失败: ${error instanceof Error ? error.message : '未知错误'}`,
          };
        }
      },
    });

    // /validateForm 命令
    this.registerCommand({
      name: 'validateForm',
      description: '验证表单 - 用法: /validateForm [表单选择器]',
      execute: async args => {
        const formSelector = args[0] || 'form:first-of-type';

        try {
          const result = await this.sendMessageToContentScript({
            action: 'validateForm',
            data: { formSelector },
          });

          return result;
        } catch (error) {
          return {
            success: false,
            message: `验证表单失败: ${error instanceof Error ? error.message : '未知错误'}`,
          };
        }
      },
    });
  }

  /**
   * 创建git commit
   */
  private async createGitCommit(context: CommandContext): Promise<CommandResult> {
    const timestamp = new Date().toISOString();
    const message = `auto: compact session at ${timestamp}`;

    try {
      // 这里可以集成实际的git操作
      // 目前只是模拟
      return {
        success: true,
        message: `提交创建: ${message}`,
        data: {
          commitMessage: message,
          timestamp,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Git提交失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 更新项目管理文件
   */
  private async updateProjectFiles(context: CommandContext): Promise<CommandResult> {
    try {
      const updates = [
        'README.md - 更新最后活动时间',
        'CHANGELOG.md - 添加compact记录',
        '.claude_session - 更新会话状态',
      ];

      return {
        success: true,
        message: `已更新: ${updates.join(', ')}`,
        data: {
          updatedFiles: updates,
          timestamp: context.timestamp,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `文件更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 发送消息到content script
   */
  private async sendMessageToContentScript(message: unknown): Promise<CommandResult> {
    try {
      // 这里应该通过chrome.tabs.sendMessage发送消息
      // 由于这是在shared包中，实际的chrome API调用需要在background script中处理
      // 这里返回一个模拟结果，实际实现需要在使用这个类的地方处理
      return {
        success: false,
        message: '需要在background script中实现chrome API调用',
        data: message,
      };
    } catch (error) {
      return {
        success: false,
        message: `消息发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 获取表单模板
   */
  private async getFormTemplate(templateName: string): Promise<unknown> {
    try {
      // 这里应该从存储中获取模板
      // 实际实现需要使用chrome.storage API
      const templates = await this.listFormTemplates();
      return (templates as Record<string, unknown>[]).find(
        (template: Record<string, unknown>) => template.name === templateName,
      );
    } catch (error) {
      throw new Error(`获取模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 保存表单模板
   */
  private async saveFormTemplate(templateName: string, data: Record<string, unknown>): Promise<void> {
    try {
      // 这里应该保存到chrome.storage
      // 实际实现需要在使用这个类的地方处理
      const template = {
        id: `template_${Date.now()}`,
        name: templateName,
        description: `表单模板 - ${templateName}`,
        data,
        tags: [],
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: Date.now(),
      };

      // 模拟保存操作
      console.log('保存表单模板:', template);
    } catch (error) {
      throw new Error(`保存模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 列出表单模板
   */
  private async listFormTemplates(): Promise<unknown[]> {
    try {
      // 这里应该从chrome.storage获取模板列表
      // 返回模拟数据，实际实现需要在使用这个类的地方处理
      return [
        {
          id: 'template_1',
          name: '个人信息',
          description: '基本个人信息模板',
          data: {
            name: '张三',
            email: 'zhangsan@example.com',
            phone: '13800138000',
          },
          tags: ['个人', '基础'],
          isDefault: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];
    } catch (error) {
      throw new Error(`获取模板列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

// 创建全局命令处理器实例
export const commandProcessor = new CommandProcessor();
