/**
 * Harness Types - AI Agent 外壳模式类型定义
 *
 * 基于 Claude Code / Cursor / Manus 的最佳实践
 * 核心原则：
 * 1. 渐进式披露 (Progressive Disclosure)
 * 2. 原子原语优于集成 (Primitives over Integration)
 * 3. 简单循环架构 (Simple Loop Architecture)
 * 4. 40% 阈值法则 (40% Threshold Rule)
 */

// ============ 原子工具定义 ============

/**
 * 终端原子操作原语
 * 遵循 Claude Code 的 "约18个原语" 设计哲学
 */
export type TerminalPrimitive =
  | 'read'      // 读取输出
  | 'write'     // 写入输入
  | 'resize'    // 调整大小
  | 'kill'      // 终止进程
  | 'spawn';    // 创建进程

/**
 * 工具定义接口
 * 支持延迟加载（渐进式披露）
 */
export interface ToolDefinition {
  name: string;
  description: string;
  category: 'discovery' | 'file' | 'web' | 'orchestration';
  loadOnDemand: boolean;  // 是否延迟加载
  handler?: (...args: any[]) => any;
}

// ============ 渐进式披露 ============

/**
 * 上下文层级
 * 参考 Claude Code 的 6 层信息加载
 */
export interface ContextLayers {
  /** 系统配置 - 始终加载 */
  system: SystemConfig;
  /** 项目配置 - 按项目加载 */
  project?: ProjectConfig;
  /** 用户设置 - 按用户加载 */
  user?: UserConfig;
  /** 会话状态 - 动态更新 */
  session: SessionState;
  /** 历史记录 - 可选加载 */
  history?: HistoryEntry[];
  /** 环境状态 - 按需刷新 */
  environment?: EnvironmentState;
  /** 压缩的观察结果（用于 ContextManager 内部） */
  compressedObservations?: CompressedObservation[];
}

/**
 * 技能定义（延迟加载模式）
 * 类似 Claude Code 的 SKILL.md 模式
 */
export interface SkillDefinition {
  id: string;
  name: string;
  trigger: string | RegExp;  // 触发条件
  loaded: boolean;
  load: () => Promise<string>;  // 延迟加载函数
}

// ============ 状态管理 ============

/**
 * 会话状态
 * 作为"进度锚点"（类似 TodoWrite）
 */
export interface SessionState {
  id: string;
  createdAt: number;
  lastActivity: number;
  status: 'active' | 'idle' | 'error';
  /** 进度锚点 - 记录当前任务 */
  anchor?: ProgressAnchor;
  /** 压缩的观察结果 */
  compressedObservations: CompressedObservation[];
}

/**
 * 进度锚点
 * 防止长轨迹任务走偏
 */
export interface ProgressAnchor {
  task: string;
  step: number;
  totalSteps?: number;
  lastUpdate: number;
  metadata?: Record<string, any>;
}

/**
 * 压缩的观察结果
 * 参考 SWE-Agent 的观察压缩模式
 */
export interface CompressedObservation {
  timestamp: number;
  summary: string;      // 单行摘要
  fullContent?: string; // 仅保留最近5条的完整内容
}

// ============ 配置类型 ============

export interface SystemConfig {
  port: number;
  host: string;
  authRequired: boolean;
  useTmux: boolean;
}

export interface ProjectConfig {
  name: string;
  cwd: string;
  customCommands: CommandDefinition[];
}

export interface UserConfig {
  theme?: 'dark' | 'light';
  fontSize?: number;
  shortcuts?: Record<string, string>;
}

export interface CommandDefinition {
  name: string;
  cmd: string;
  description?: string;
  /** 延迟加载完整定义 */
  expanded?: boolean;
}

export interface HistoryEntry {
  timestamp: number;
  type: 'input' | 'output';
  content: string;
  compressed: boolean;
}

export interface EnvironmentState {
  platform: string;
  shell: string;
  tmuxAvailable: boolean;
  wslEnabled: boolean;
}

// ============ 事件类型 ============

/**
 * 终端事件类型
 * 简单循环架构的核心
 */
export type TerminalEvent =
  | { type: 'start'; cwd: string }
  | { type: 'input'; data: string }
  | { type: 'output'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string };

/**
 * 事件处理器
 */
export type EventHandler<E extends TerminalEvent> = (event: E) => void | Promise<void>;

// ============ KV 缓存优化 ============

/**
 * 工具注册表
 * 参考 Manus 的 Logit 掩码模式
 */
export interface ToolRegistry {
  /** 所有工具定义（一次性加载） */
  definitions: Map<string, ToolDefinition>;
  /** 当前可用的工具名称 */
  availableTools: Set<string>;
  /** 工具分组（用于批量掩码） */
  groups: Map<string, Set<string>>;

  /** 启用工具组 */
  enableGroup(group: string): void;
  /** 禁用工具组 */
  disableGroup(group: string): void;
  /** 检查工具是否可用 */
  isAvailable(toolName: string): boolean;
}

// ============ 输出压缩 ============

/**
 * 输出压缩配置
 * 参考 SWE-Agent 的观察压缩
 */
export interface OutputCompressionConfig {
  /** 保留完整内容的最近 N 条 */
  keepFullCount: number;
  /** 单行摘要最大长度 */
  summaryMaxLength: number;
  /** 总输出 Token 阈值（40% 法则） */
  tokenThreshold: number;
  /** 压缩策略 */
  strategy: 'sliding-window' | 'importance-based' | 'time-based';
}

/**
 * 默认压缩配置
 */
export const DEFAULT_COMPRESSION_CONFIG: OutputCompressionConfig = {
  keepFullCount: 5,
  summaryMaxLength: 100,
  tokenThreshold: 0.4,  // 40% 阈值
  strategy: 'sliding-window',
};
