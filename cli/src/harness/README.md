# Harness 模式集成指南

## 概述

本目录实现了 AI Agent 外壳（Harness）模式，基于 Claude Code / Cursor / Manus 的最佳实践。

## 核心模式

### 1. 渐进式披露 (Progressive Disclosure)

```typescript
// ❌ 传统方式：一次性加载所有配置
const allCommands = parseCustomCommands(process.env.CUSTOM_COMMANDS);

// ✅ Harness 方式：按需加载
import { toolRegistry } from './harness';

// 只注册名称和描述（轻量级）
toolRegistry.registerCustomCommands(customCommands);

// 需要时才加载完整定义
const tool = toolRegistry.getToolDefinition('command.claude');
```

**效果**：Token 减少 46.9%（Cursor 实测数据）

### 2. 进度锚点 (Progress Anchor)

```typescript
// 类似 Claude Code 的 TodoWrite
import { eventLoop } from './harness';

// 设置锚点
eventLoop.setAnchor('启动终端会话', 1, 3);

// 更新进度
eventLoop.updateAnchor(2);

// 完成
eventLoop.clearAnchor();
```

**效果**：防止长轨迹任务走偏，出错后能快速恢复

### 3. 观察压缩 (Observation Compression)

```typescript
// 参考 SWE-Agent：除最后 5 条外全部压缩为单行
import { ContextManager } from './harness';

const ctx = new ContextManager();

// 自动压缩旧观察
ctx.addObservation(terminalOutput);

// 获取压缩输出（用于受限上下文）
const compressed = ctx.getCompressedOutput();
```

**效果**：26 倍 Token 效率提升

### 4. 40% 阈值法则

```typescript
// 检查 Token 使用情况
const summary = ctx.getContextSummary();
console.log(`Token 使用: ${summary.tokenUsage}`);

// 超过 40% 时自动触发压缩
if (parseFloat(summary.tokenUsage) > 40) {
  // 进入"愚蠢区"警告
}
```

## 集成到现有代码

### 步骤 1: 替换自定义命令加载

```typescript
// 原代码 (src/index.ts)
const CUSTOM_COMMANDS = parseCustomCommands(process.env.CUSTOM_COMMANDS);

// 新代码
import { toolRegistry } from './harness';
const CUSTOM_COMMANDS = parseCustomCommands(process.env.CUSTOM_COMMANDS);
toolRegistry.registerCustomCommands(CUSTOM_COMMANDS);
```

### 步骤 2: 添加进度追踪

```typescript
// 原代码
socket.on('start-process', (data) => {
  const proc = processManager.startProcess(cwd);
  // ...
});

// 新代码
import { eventLoop } from './harness';

socket.on('start-process', (data) => {
  eventLoop.setAnchor('启动进程', 1, 3);

  const proc = processManager.startProcess(cwd);
  eventLoop.updateAnchor(2);

  // 注册回调
  processManager.registerCallback(proc.id, socket.id, (output) => {
    ctx.addObservation(output);  // 自动压缩
    eventLoop.updateAnchor(3);
  });

  eventLoop.clearAnchor();
});
```

### 步骤 3: 输出压缩

```typescript
// 原代码
socket.emit('claude-output', { id: proc.id, output });

// 新代码
// 短输出直接发送，长输出压缩
if (output.length > 1000) {
  ctx.addObservation(output);
  // 发送摘要 + 完整内容链接
  socket.emit('claude-output', {
    id: proc.id,
    output: ctx.getCompressedOutput(),
    full: false,
  });
} else {
  socket.emit('claude-output', { id: proc.id, output, full: true });
}
```

## 架构对比

### 传统架构
```
┌─────────────┐
│  启动时加载  │
│  所有配置    │
└──────┬──────┘
       │
┌──────▼──────┐
│  处理事件    │
│  无状态      │
└─────────────┘
```

### Harness 架构
```
┌─────────────────────────────────────┐
│          渐进式披露                  │
│  ┌─────────┐  ┌─────────┐          │
│  │ 轻量元数据│  │ 延迟加载 │          │
│  │ (启动)   │──▶│ (按需)  │          │
│  └─────────┘  └─────────┘          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│          简单事件循环                │
│  while (events) {                   │
│    process → compress → emit        │
│  }                                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│          进度锚点 + 压缩             │
│  ┌────────────┐  ┌────────────┐     │
│  │ TodoWrite  │  │ 观察压缩   │     │
│  │ 进度追踪   │  │ 保留5条    │     │
│  └────────────┘  └────────────┘     │
└─────────────────────────────────────┘
```

## 性能指标

| 指标 | 传统方式 | Harness 方式 | 提升 |
|------|----------|-------------|------|
| Token 消耗 | 25,000 | 955 | 26x |
| 工具加载 | 全部 | 按需 | 46.9% |
| 错误恢复 | 无 | 自动重试 | ✅ |
| 任务追踪 | 无 | 锚点 | ✅ |

## 最佳实践

1. **延迟加载非核心工具**
   - 核心工具（terminal.*）始终加载
   - 辅助工具（command.*, system.*）按需加载

2. **使用进度锚点**
   - 长任务开始时设置锚点
   - 定期更新进度
   - 完成后清除

3. **监控 Token 使用**
   - 定期检查 tokenUsage
   - 超过 40% 时触发压缩

4. **保留完整输出的场景**
   - 最近 5 条观察
   - 用户明确请求
   - 错误诊断

## 参考

- [AI Agent Harness 深度解析](../03-Resources/AI-Agent-Harness-脚手架架构深度解析.md)
- Anthropic: "Effective Harnesses for Long-Running Agents"
- Cursor: "Dynamic Context Discovery"
- Manus: "Context Engineering for AI Agents"
