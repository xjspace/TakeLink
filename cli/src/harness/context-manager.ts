/**
 * Context Manager - 上下文管理器
 *
 * 实现渐进式披露模式
 * 参考 Claude Code 的分层上下文加载
 */

import {
  ContextLayers,
  SessionState,
  ProgressAnchor,
  CompressedObservation,
  OutputCompressionConfig,
  DEFAULT_COMPRESSION_CONFIG,
  SkillDefinition,
} from './types.js';

export class ContextManager {
  private layers: ContextLayers;
  private skills: Map<string, SkillDefinition> = new Map();
  private compressionConfig: OutputCompressionConfig;
  private estimatedTokens: number = 0;
  private maxTokens: number = 200000;  // 假设 200k 上下文窗口

  constructor(config?: Partial<OutputCompressionConfig>) {
    this.compressionConfig = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
    this.layers = {
      system: {
        port: 8080,
        host: '::',
        authRequired: false,
        useTmux: true,
      },
      session: this.createSession(),
      compressedObservations: [],
    };
  }

  // ============ 会话管理 ============

  private createSession(): SessionState {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
      compressedObservations: [],
    };
  }

  getSession(): SessionState {
    return this.layers.session;
  }

  // ============ 进度锚点（类似 TodoWrite）============

  /**
   * 设置进度锚点
   * 作为"进度锚点"防止长轨迹任务走偏
   */
  setAnchor(task: string, step: number, totalSteps?: number, metadata?: Record<string, any>): void {
    this.layers.session.anchor = {
      task,
      step,
      totalSteps,
      lastUpdate: Date.now(),
      metadata,
    };
    this.addObservation(`[锚点] ${task} (${step}/${totalSteps ?? '?'})`);
  }

  /**
   * 更新锚点进度
   */
  updateAnchor(step: number, metadata?: Record<string, any>): void {
    if (this.layers.session.anchor) {
      this.layers.session.anchor.step = step;
      this.layers.session.anchor.lastUpdate = Date.now();
      if (metadata) {
        this.layers.session.anchor.metadata = {
          ...this.layers.session.anchor.metadata,
          ...metadata,
        };
      }
    }
  }

  /**
   * 清除锚点（任务完成）
   */
  clearAnchor(): void {
    if (this.layers.session.anchor) {
      this.addObservation(`[完成] ${this.layers.session.anchor.task}`);
      this.layers.session.anchor = undefined;
    }
  }

  // ============ 观察压缩 ============

  /**
   * 添加观察结果
   * 自动压缩旧观察，保留最近 N 条完整内容
   */
  addObservation(content: string): void {
    const now = Date.now();
    const observation: CompressedObservation = {
      timestamp: now,
      summary: this.summarize(content),
      fullContent: content,
    };

    this.layers.session.compressedObservations.push(observation);
    this.layers.session.lastActivity = now;

    // 压缩旧观察（保留最近 N 条完整）
    this.compressOldObservations();

    // 检查 Token 阈值
    this.checkTokenThreshold();
  }

  /**
   * 压缩旧观察结果
   * 参考 SWE-Agent：除最后 5 条外全部压缩为单行
   */
  private compressOldObservations(): void {
    const observations = this.layers.session.compressedObservations;
    const keepFull = this.compressionConfig.keepFullCount;

    if (observations.length > keepFull) {
      // 压缩超过阈值的老观察
      for (let i = 0; i < observations.length - keepFull; i++) {
        if (observations[i].fullContent) {
          observations[i].fullContent = undefined;  // 丢弃完整内容，只保留摘要
        }
      }
    }

    // 如果观察数量过多，移除最旧的
    const maxObservations = 100;
    if (observations.length > maxObservations) {
      observations.splice(0, observations.length - maxObservations);
    }
  }

  /**
   * 生成单行摘要
   */
  private summarize(content: string): string {
    const maxLength = this.compressionConfig.summaryMaxLength;
    // 移除 ANSI 转义序列
    const clean = content.replace(/\x1b\[[0-9;]*m/g, '');
    // 压缩空白
    const condensed = clean.replace(/\s+/g, ' ').trim();
    // 截断
    return condensed.length > maxLength
      ? condensed.slice(0, maxLength - 3) + '...'
      : condensed;
  }

  /**
   * 检查 Token 阈值（40% 法则）
   */
  private checkTokenThreshold(): void {
    // 粗略估算 Token 数量（4 字符 ≈ 1 token）
    const totalChars = this.layers.session.compressedObservations
      .reduce((sum, obs) => sum + (obs.fullContent?.length ?? obs.summary.length), 0);
    this.estimatedTokens = Math.ceil(totalChars / 4);

    const threshold = this.maxTokens * this.compressionConfig.tokenThreshold;
    if (this.estimatedTokens > threshold) {
      console.warn(`[Harness] Token 阈值警告: ${this.estimatedTokens} > ${threshold} (40%)`);
      // 触发更激进的压缩
      this.aggressiveCompress();
    }
  }

  /**
   * 激进压缩
   */
  private aggressiveCompress(): void {
    const observations = this.layers.session.compressedObservations;
    // 只保留最近 10 条
    while (observations.length > 10) {
      observations.shift();
    }
  }

  /**
   * 获取当前上下文摘要
   */
  getContextSummary(): {
    sessionId: string;
    status: string;
    anchor?: ProgressAnchor;
    observationCount: number;
    estimatedTokens: number;
    tokenUsage: string;
  } {
    const session = this.layers.session;
    return {
      sessionId: session.id,
      status: session.status,
      anchor: session.anchor,
      observationCount: session.compressedObservations.length,
      estimatedTokens: this.estimatedTokens,
      tokenUsage: `${((this.estimatedTokens / this.maxTokens) * 100).toFixed(1)}%`,
    };
  }

  // ============ 渐进式技能加载 ============

  /**
   * 注册技能（延迟加载）
   * 类似 Claude Code 的 SKILL.md 模式
   */
  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * 检查并加载相关技能
   * 基于触发条件匹配
   */
  async loadRelevantSkills(input: string): Promise<string[]> {
    const loaded: string[] = [];

    for (const [id, skill] of this.skills) {
      if (!skill.loaded) {
        const shouldLoad = typeof skill.trigger === 'string'
          ? input.includes(skill.trigger)
          : skill.trigger.test(input);

        if (shouldLoad) {
          await skill.load();
          skill.loaded = true;
          loaded.push(id);
        }
      }
    }

    return loaded;
  }

  /**
   * 获取已加载的技能
   */
  getLoadedSkills(): string[] {
    return Array.from(this.skills.entries())
      .filter(([_, skill]) => skill.loaded)
      .map(([id]) => id);
  }

  // ============ 输出获取 ============

  /**
   * 获取完整输出（用于发送给客户端）
   */
  getFullOutput(): string {
    return this.layers.session.compressedObservations
      .map(obs => obs.fullContent ?? obs.summary)
      .join('\n');
  }

  /**
   * 获取压缩输出（用于上下文窗口受限场景）
   */
  getCompressedOutput(): string {
    const recent = this.layers.session.compressedObservations.slice(-5);
    const older = this.layers.session.compressedObservations.slice(0, -5);

    const parts: string[] = [];

    if (older.length > 0) {
      parts.push(`[... ${older.length} 条历史记录已压缩 ...]`);
      parts.push(older.map(obs => `  > ${obs.summary}`).join('\n'));
    }

    if (recent.length > 0) {
      parts.push(recent.map(obs => obs.fullContent ?? obs.summary).join('\n'));
    }

    return parts.join('\n\n');
  }
}
