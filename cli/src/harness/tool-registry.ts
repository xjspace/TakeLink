/**
 * Tool Registry - 工具注册表
 *
 * 实现渐进式披露和 Logit 掩码模式
 * 参考 Cursor 的延迟加载和 Manus 的 KV 缓存优化
 */

import { ToolDefinition, ToolRegistry } from './types.js';

/**
 * 工具组定义
 * 用于批量启用/禁用（类似 Manus 的工具前缀分组）
 */
const TOOL_GROUPS = {
  terminal: ['terminal.start', 'terminal.input', 'terminal.resize', 'terminal.kill'],
  session: ['session.list', 'session.select', 'session.create'],
  command: ['command.run', 'command.list', 'command.define'],
  system: ['system.info', 'system.health', 'system.config'],
} as const;

/**
 * 默认原子工具定义
 * 参考 Claude Code 的 "约18个原语" 设计
 */
const DEFAULT_TOOLS: ToolDefinition[] = [
  // 终端操作（核心原语）
  {
    name: 'terminal.start',
    description: '启动新的终端会话',
    category: 'discovery',
    loadOnDemand: false,  // 核心工具始终加载
  },
  {
    name: 'terminal.input',
    description: '向终端发送输入',
    category: 'discovery',
    loadOnDemand: false,
  },
  {
    name: 'terminal.resize',
    description: '调整终端大小',
    category: 'discovery',
    loadOnDemand: false,
  },
  {
    name: 'terminal.kill',
    description: '终止终端会话',
    category: 'discovery',
    loadOnDemand: false,
  },

  // 会话管理
  {
    name: 'session.list',
    description: '列出所有会话',
    category: 'orchestration',
    loadOnDemand: false,
  },
  {
    name: 'session.select',
    description: '选择并切换会话',
    category: 'orchestration',
    loadOnDemand: false,
  },
  {
    name: 'session.create',
    description: '创建新会话',
    category: 'orchestration',
    loadOnDemand: true,  // 延迟加载
  },

  // 命令执行
  {
    name: 'command.run',
    description: '执行自定义命令',
    category: 'file',
    loadOnDemand: true,
  },
  {
    name: 'command.list',
    description: '列出可用命令',
    category: 'file',
    loadOnDemand: true,
  },

  // 系统信息
  {
    name: 'system.info',
    description: '获取系统信息',
    category: 'web',
    loadOnDemand: true,
  },
  {
    name: 'system.health',
    description: '健康检查',
    category: 'web',
    loadOnDemand: true,
  },
];

export class HarnessToolRegistry implements ToolRegistry {
  definitions: Map<string, ToolDefinition> = new Map();
  availableTools: Set<string> = new Set();
  groups: Map<string, Set<string>> = new Map();

  private loadedDefinitions: Map<string, boolean> = new Map();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // 注册默认工具
    for (const tool of DEFAULT_TOOLS) {
      this.definitions.set(tool.name, tool);
      this.loadedDefinitions.set(tool.name, !tool.loadOnDemand);

      // 非延迟加载的工具默认可用
      if (!tool.loadOnDemand) {
        this.availableTools.add(tool.name);
      }
    }

    // 初始化工具组
    for (const [groupName, toolNames] of Object.entries(TOOL_GROUPS)) {
      this.groups.set(groupName, new Set(toolNames));
    }
  }

  // ============ 渐进式披露 ============

  /**
   * 获取工具名称列表（轻量级）
   * 只返回名称，不加载完整定义
   * 参考 Cursor 的延迟 MCP 工具加载
   */
  getToolNames(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * 获取工具完整定义（按需加载）
   */
  getToolDefinition(name: string): ToolDefinition | undefined {
    const tool = this.definitions.get(name);
    if (tool && !this.loadedDefinitions.get(name)) {
      // 标记为已加载
      this.loadedDefinitions.set(name, true);
      // 加入可用工具集
      this.availableTools.add(name);
    }
    return tool;
  }

  /**
   * 批量获取工具定义
   */
  getToolDefinitions(names: string[]): ToolDefinition[] {
    return names
      .map(name => this.getToolDefinition(name))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  // ============ Logit 掩码模式 ============

  /**
   * 启用工具组
   * 类似 Manus 的组级别掩码操作
   */
  enableGroup(group: string): void {
    const tools = this.groups.get(group);
    if (tools) {
      tools.forEach(name => {
        this.availableTools.add(name);
      });
    }
  }

  /**
   * 禁用工具组
   */
  disableGroup(group: string): void {
    const tools = this.groups.get(group);
    if (tools) {
      tools.forEach(name => {
        this.availableTools.delete(name);
      });
    }
  }

  /**
   * 检查工具是否可用
   */
  isAvailable(toolName: string): boolean {
    return this.availableTools.has(toolName);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): string[] {
    return Array.from(this.availableTools);
  }

  // ============ 工具统计 ============

  /**
   * 获取工具统计信息
   */
  getStats(): {
    total: number;
    loaded: number;
    available: number;
    tokenSavings: string;
  } {
    const total = this.definitions.size;
    const loaded = Array.from(this.loadedDefinitions.values()).filter(Boolean).length;
    const available = this.availableTools.size;

    // 估算 Token 节省（假设每个完整定义约 50 tokens）
    const unloaded = total - loaded;
    const savedTokens = unloaded * 50;

    return {
      total,
      loaded,
      available,
      tokenSavings: savedTokens > 0 ? `~${savedTokens} tokens saved` : 'none',
    };
  }

  // ============ 自定义工具注册 ============

  /**
   * 注册自定义工具
   */
  registerTool(tool: ToolDefinition): void {
    this.definitions.set(tool.name, tool);
    this.loadedDefinitions.set(tool.name, !tool.loadOnDemand);

    if (!tool.loadOnDemand) {
      this.availableTools.add(tool.name);
    }
  }

  /**
   * 从自定义命令创建工具
   */
  registerCustomCommands(commands: Array<{ name: string; cmd: string }>): void {
    for (const cmd of commands) {
      this.registerTool({
        name: `command.${cmd.name}`,
        description: `执行自定义命令: ${cmd.name}`,
        category: 'file',
        loadOnDemand: true,
      });
    }
  }
}

// 导出单例
export const toolRegistry = new HarnessToolRegistry();
