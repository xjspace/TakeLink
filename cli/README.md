# TakeLink

**局域网远程终端 — 随时随地接管你的终端**

[中文](README.md) | [English](README_EN.md)

---

## What is TakeLink

TakeLink 是一个自建的远程终端控制工具，通过浏览器/手机即可完全操控你电脑上的终端。基于 xterm.js + node-pty 实现真实的 PTY 终端体验，支持 tmux 会话持久化。

## Quick Start

```bash
# 安装依赖
pnpm install

# 启动服务
pnpm dev

# 扫描终端二维码，或浏览器打开显示的 URL
```

## Configuration

复制 `.env` 文件并按需修改：

```env
PORT=8080                          # 服务端口
PASSWORD=                          # 访问密码（可选）
USE_TMUX=true                      # tmux 会话持久化
CLAUDE_COMMAND=/bin/bash           # 默认终端命令
DEFAULT_CWD=                       # 默认工作目录
CUSTOM_COMMANDS=Claude:claude,Git:git status  # 快捷命令
```

## Core Features

- **真实 PTY 终端** — 基于 node-pty，完整的终端体验（颜色、交互、tab 补全）
- **QR 码连接** — 启动即生成二维码，手机扫码直连
- **多会话管理** — 同时运行多个终端，自由切换
- **tmux 持久化** — 浏览器关闭后会话不丢失，重新连接即可恢复
- **自定义命令** — 通过工具栏一键启动 Claude Code、Git 等常用工具
- **密码认证** — Token + 密码双重认证，24h 自动过期
- **IPv4 + IPv6** — 局域网 IPv4 和公网 IPv6 双栈支持

## Why TakeLink

与官方 Claude Remote Control 等方案相比，TakeLink 有以下独特优势：

### 完全离线，无需互联网

纯局域网通信，断网照样用。数据不经过任何第三方服务器，隐私有保障。

### 通用终端控制，不限于任何工具

不只是 Claude Code。任意 shell 命令、Python 脚本、Git 操作、Docker 管理……只要是终端能做的，手机都能做。

### 多会话并行

同时管理多个终端进程，自由创建、切换、关闭。一个手机管多台机器的多个任务。

### 完全自控

自建服务，数据不上传。无需订阅，无需 OAuth，无需互联网中转。你的终端，你做主。

### Harness 智能模式

内置 AI Agent Harness 架构：
- **渐进式披露** — 按需加载工具定义，Token 消耗降低 46.9%
- **输出压缩** — 自动压缩长输出，Token 效率提升 26 倍
- **进度锚点** — 追踪长时间任务进度，防止走偏
- **Token 监控** — 40% 阈值告警

### tmux 会话持久化

浏览器关了、手机锁了，终端还在跑。重新连接，原地恢复。支持 Linux 原生 tmux 和 Windows WSL + tmux。

### 移动端优化

- Capacitor Android 原生 App
- 响应式 Web UI，适配手机/平板
- 虚拟键盘快捷键（Ctrl+C、Tab 等）
- 暗色主题

### Dashboard 监控

内置统计仪表盘，实时查看连接数、终端数、认证记录、自定义命令使用情况。

## Architecture

```
┌─────────────┐     Socket.IO      ┌──────────────┐
│  浏览器/App  │ ◄──────────────► │   TakeLink   │
│  (xterm.js)  │    WebSocket      │   Server     │
└─────────────┘                    │              │
                                   │  node-pty    │
                                   │  process     │
┌─────────────┐     Socket.IO      │  manager     │
│  另一台设备   │ ◄──────────────► │              │
│  (xterm.js)  │                   │  Harness     │
└─────────────┘                    │  Stats       │
                                   └──────┬───────┘
                                          │
                                   ┌──────▼───────┐
                                   │  PTY / tmux  │
                                   │  终端进程     │
                                   └──────────────┘
```

## Tech Stack

- **Backend**: Node.js + Express + Socket.IO + node-pty
- **Frontend**: xterm.js + vanilla JS
- **Mobile**: Capacitor (Android)
- **Persistence**: tmux (Linux/WSL)
- **AI Optimization**: Harness 模式（渐进式披露、输出压缩、进度锚点）

## License

MIT
