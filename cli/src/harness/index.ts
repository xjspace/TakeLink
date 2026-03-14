/**
 * Harness - AI Agent 外壳模式实现
 *
 * 基于 Claude Code / Cursor / Manus 的最佳实践
 *
 * 核心模式：
 * 1. 渐进式披露 (Progressive Disclosure) - 按需加载工具和上下文
 * 2. 原子原语 (Atomic Primitives) - 约18个核心工具
 * 3. 简单循环 (Simple Loop) - while(tool_call) 模式
 * 4. 进度锚点 (Progress Anchor) - TodoWrite 模式
 * 5. 观察压缩 (Observation Compression) - 保留最近5条完整
 * 6. 40% 阈值 (Token Threshold) - 避免进入"愚蠢区"
 *
 * @example
 * ```typescript
 * import { HarnessEventLoop, ContextManager, toolRegistry } from './harness';
 *
 * // 创建事件循环
 * const loop = new HarnessEventLoop();
 *
 * // 设置进度锚点
 * loop.setAnchor('执行任务', 1, 5);
 *
 * // 提交事件
 * loop.submit({ type: 'input', data: 'ls -la' });
 *
 * // 获取上下文摘要
 * const summary = loop.getContextSummary();
 * ```
 */

// 类型定义
export * from './types.js';

// 核心组件
export { ContextManager } from './context-manager.js';
export { HarnessToolRegistry, toolRegistry } from './tool-registry.js';
export { HarnessEventLoop, eventLoop, integrateWithSocket } from './event-loop.js';
export { HarnessEnhancer, harnessEnhancer } from './process-manager-harness.js';

// 版本信息
export const HARNESS_VERSION = '1.0.0';
export const HARNESS_PATTERNS = [
  'progressive-disclosure',
  'atomic-primitives',
  'simple-loop',
  'progress-anchor',
  'observation-compression',
  'token-threshold',
] as const;
