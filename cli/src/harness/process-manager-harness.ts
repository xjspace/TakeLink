/**
 * Harness 集成 - 增强版 ProcessManager
 *
 * 将 Harness 模式集成到现有 ProcessManager
 * 主要改进：
 * 1. 输出自动压缩
 * 2. 进度锚点追踪
 * 3. 渐进式工具加载
 */

import { ContextManager } from './context-manager.js';
import { toolRegistry } from './tool-registry.js';
import { eventLoop, integrateWithSocket } from './event-loop.js';

/**
 * Harness 增强器
 * 使用组合模式而非 mixin（避免 TypeScript 限制）
 */
export class HarnessEnhancer {
  private _contextManagers = new Map<string, ContextManager>();
  private _outputBuffer = new Map<string, string[]>();
  private _compressionThreshold = 5000;  // 字符数

  /**
   * 为进程创建上下文
   */
  createContext(processId: string): ContextManager {
    const ctx = new ContextManager();
    this._contextManagers.set(processId, ctx);
    this._outputBuffer.set(processId, []);
    return ctx;
  }

  /**
   * 处理输出（带压缩）
   */
  handleOutput(processId: string, data: string): void {
    const ctx = this._contextManagers.get(processId);
    const buffer = this._outputBuffer.get(processId);

    if (!ctx || !buffer) return;

    // 添加到缓冲区
    buffer.push(data);
    ctx.addObservation(data);

    // 检查是否需要压缩
    const totalLength = buffer.reduce((sum, s) => sum + s.length, 0);
    if (totalLength > this._compressionThreshold) {
      this._compressBuffer(processId);
    }
  }

  /**
   * 压缩缓冲区
   */
  private _compressBuffer(processId: string): void {
    const buffer = this._outputBuffer.get(processId);
    if (!buffer || buffer.length <= 5) return;

    // 保留最近 5 条
    const recent = buffer.slice(-5);
    const older = buffer.slice(0, -5);

    // 压缩旧输出为摘要
    const compressed = older.map(s => {
      const clean = s.replace(/\x1b\[[0-9;]*m/g, '').trim();
      return clean.length > 100 ? clean.slice(0, 97) + '...' : clean;
    });

    // 更新缓冲区
    this._outputBuffer.set(processId, [
      `[... ${compressed.length} 条已压缩 ...]`,
      ...recent
    ]);
  }

  /**
   * 获取压缩输出
   */
  getCompressedOutput(processId: string): string {
    const buffer = this._outputBuffer.get(processId);
    return buffer ? buffer.join('\n') : '';
  }

  /**
   * 获取上下文摘要
   */
  getContextSummary(processId: string): ReturnType<ContextManager['getContextSummary']> | null {
    const ctx = this._contextManagers.get(processId);
    return ctx ? ctx.getContextSummary() : null;
  }

  /**
   * 获取上下文管理器
   */
  getContext(processId: string): ContextManager | undefined {
    return this._contextManagers.get(processId);
  }

  /**
   * 清理进程资源
   */
  cleanup(processId: string): void {
    this._contextManagers.delete(processId);
    this._outputBuffer.delete(processId);
  }

  /**
   * 获取所有活动进程 ID
   */
  getActiveProcessIds(): string[] {
    return Array.from(this._contextManagers.keys());
  }
}

/**
 * 全局增强器实例
 */
export const harnessEnhancer = new HarnessEnhancer();

/**
 * 使用示例
 *
 * import { harnessEnhancer } from './harness/process-manager-harness.js';
 *
 * // 在 startProcess 中
 * const ctx = harnessEnhancer.createContext(proc.id);
 * ctx.setAnchor('启动终端', 1, 3);
 *
 * // 在回调中
 * harnessEnhancer.handleOutput(proc.id, output);
 *
 * // 获取摘要
 * const summary = harnessEnhancer.getContextSummary(proc.id);
 * console.log(`Token: ${summary.tokenUsage}`);
 *
 * // 清理
 * harnessEnhancer.cleanup(proc.id);
 */

// 导出工具
export { ContextManager, toolRegistry, eventLoop, integrateWithSocket };
