/**
 * Event Loop - 简单事件循环
 *
 * 实现 Claude Code 的 "模型控制循环" 模式
 * 核心循环：执行工具 → 捕获结果 → 附加到上下文 → 再次调用
 */

import { Socket } from 'socket.io';
import { TerminalEvent, EventHandler, SessionState, ProgressAnchor } from './types.js';
import { ContextManager } from './context-manager.js';
import { HarnessToolRegistry, toolRegistry } from './tool-registry.js';

/**
 * 事件循环配置
 */
interface EventLoopConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 错误恢复延迟（ms） */
  errorRecoveryDelay: number;
  /** 是否启用观察压缩 */
  enableCompression: boolean;
  /** Token 阈值（40% 法则） */
  tokenThreshold: number;
}

const DEFAULT_CONFIG: EventLoopConfig = {
  maxRetries: 3,
  errorRecoveryDelay: 1000,
  enableCompression: true,
  tokenThreshold: 0.4,
};

/**
 * 事件循环状态
 */
type LoopState = 'idle' | 'running' | 'waiting' | 'error';

/**
 * Harness Event Loop
 * 核心事件循环实现
 */
export class HarnessEventLoop {
  private state: LoopState = 'idle';
  private contextManager: ContextManager;
  private toolRegistry: HarnessToolRegistry;
  private config: EventLoopConfig;
  private handlers: Map<string, EventHandler<any>[]> = new Map();
  private pendingEvents: TerminalEvent[] = [];
  private retryCount: number = 0;

  constructor(config?: Partial<EventLoopConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.contextManager = new ContextManager({
      tokenThreshold: this.config.tokenThreshold,
    });
    this.toolRegistry = toolRegistry;
  }

  // ============ 核心循环 ============

  /**
   * 简单事件循环
   * 参考 Claude Code 的 nO 循环
   */
  async run(): Promise<void> {
    this.state = 'running';

    while (this.state === 'running' && this.pendingEvents.length > 0) {
      const event = this.pendingEvents.shift();
      if (!event) break;

      try {
        await this.processEvent(event);
        this.retryCount = 0;  // 成功后重置重试计数
      } catch (error) {
        await this.handleError(event, error);
      }
    }

    this.state = 'idle';
  }

  /**
   * 处理单个事件
   */
  private async processEvent<E extends TerminalEvent>(event: E): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    // 更新会话活动时间
    this.contextManager.addObservation(
      `[事件] ${event.type}: ${JSON.stringify(event).slice(0, 100)}`
    );

    // 执行所有处理器
    for (const handler of handlers) {
      await handler(event);
    }
  }

  /**
   * 错误处理（模型驱动恢复）
   */
  private async handleError(event: TerminalEvent, error: any): Promise<void> {
    this.retryCount++;
    const errorMsg = error instanceof Error ? error.message : String(error);

    this.contextManager.addObservation(`[错误] ${event.type}: ${errorMsg}`);

    if (this.retryCount < this.config.maxRetries) {
      // 重试
      await new Promise(resolve => setTimeout(resolve, this.config.errorRecoveryDelay));
      this.pendingEvents.unshift(event);  // 放回队列头部
    } else {
      // 超过重试次数，记录错误
      this.contextManager.addObservation(`[放弃] ${event.type} 重试 ${this.retryCount} 次后失败`);
      this.state = 'error';
    }
  }

  // ============ 事件提交 ============

  /**
   * 提交事件到循环
   */
  submit(event: TerminalEvent): void {
    this.pendingEvents.push(event);
    if (this.state === 'idle') {
      this.run();
    }
  }

  /**
   * 批量提交事件
   */
  submitBatch(events: TerminalEvent[]): void {
    this.pendingEvents.push(...events);
    if (this.state === 'idle') {
      this.run();
    }
  }

  // ============ 处理器注册 ============

  /**
   * 注册事件处理器
   */
  on<E extends TerminalEvent['type']>(
    eventType: E,
    handler: EventHandler<Extract<TerminalEvent, { type: E }>>
  ): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  /**
   * 移除事件处理器
   */
  off(eventType: string, handler?: EventHandler<any>): void {
    if (!handler) {
      this.handlers.delete(eventType);
    } else {
      const existing = this.handlers.get(eventType) || [];
      const index = existing.indexOf(handler);
      if (index > -1) {
        existing.splice(index, 1);
      }
    }
  }

  // ============ 进度锚点 ============

  /**
   * 设置进度锚点（类似 TodoWrite）
   */
  setAnchor(task: string, step: number, totalSteps?: number): void {
    this.contextManager.setAnchor(task, step, totalSteps);
  }

  /**
   * 更新锚点进度
   */
  updateAnchor(step: number): void {
    this.contextManager.updateAnchor(step);
  }

  /**
   * 获取当前锚点
   */
  getAnchor(): ProgressAnchor | undefined {
    return this.contextManager.getSession().anchor;
  }

  // ============ 状态查询 ============

  /**
   * 获取循环状态
   */
  getState(): LoopState {
    return this.state;
  }

  /**
   * 获取上下文摘要
   */
  getContextSummary() {
    return this.contextManager.getContextSummary();
  }

  /**
   * 获取工具统计
   */
  getToolStats() {
    return this.toolRegistry.getStats();
  }

  /**
   * 停止循环
   */
  stop(): void {
    this.state = 'idle';
    this.pendingEvents = [];
  }
}

// ============ Socket.IO 集成 ============

/**
 * 将 Socket.IO 事件转换为 Harness 事件
 */
export function integrateWithSocket(
  socket: Socket,
  eventLoop: HarnessEventLoop,
  processManager: any
): void {
  // 终端启动
  socket.on('start-process', (data: { cwd?: string }) => {
    eventLoop.submit({
      type: 'start',
      cwd: data.cwd || process.cwd(),
    });
  });

  // 终端输入
  socket.on('terminal-input', (data: { id: string; data: string }) => {
    eventLoop.submit({
      type: 'input',
      data: data.data,
    });
  });

  // 终端调整大小
  socket.on('resize', (data: { id: string; cols: number; rows: number }) => {
    eventLoop.submit({
      type: 'resize',
      cols: data.cols,
      rows: data.rows,
    });
  });

  // 注册处理器
  eventLoop.on('start', async (event) => {
    // 实际启动逻辑由 processManager 处理
    eventLoop.setAnchor('启动终端', 1, 3);
  });

  eventLoop.on('input', async (event) => {
    // 输入处理
  });

  eventLoop.on('resize', async (event) => {
    // 调整大小处理
  });
}

// 导出单例
export const eventLoop = new HarnessEventLoop();
