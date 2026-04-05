# TakeLink

**LAN Remote Terminal — Control Your Terminal From Anywhere**

[English](README_EN.md) | [中文](README.md)

---

## What is TakeLink

TakeLink is a self-hosted remote terminal control tool. Access your computer's terminal from any browser or phone. Powered by xterm.js + node-pty for a real PTY experience, with tmux session persistence.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start server
pnpm dev

# Scan the QR code in terminal, or open the URL in browser
```

## Configuration

Copy `.env` file and customize:

```env
PORT=8080                          # Server port
PASSWORD=                          # Access password (optional)
USE_TMUX=true                      # tmux session persistence
CLAUDE_COMMAND=/bin/bash           # Default terminal command
DEFAULT_CWD=                       # Default working directory
CUSTOM_COMMANDS=Claude:claude,Git:git status  # Quick commands
```

## Core Features

- **Real PTY Terminal** — Based on node-pty, full terminal experience (colors, interaction, tab completion)
- **QR Code Connection** — QR code generated on startup, scan to connect from phone
- **Multi-Session Management** — Run multiple terminals simultaneously, switch freely
- **tmux Persistence** — Sessions survive browser close, reconnect to resume
- **Custom Commands** — One-tap launch for Claude Code, Git, and other tools via toolbar
- **Password Auth** — Token + password dual authentication, 24h auto-expiry
- **IPv4 + IPv6** — Dual-stack support for LAN IPv4 and public IPv6

## Why TakeLink

Compared to official Claude Remote Control and similar solutions, TakeLink offers unique advantages:

### Fully Offline, No Internet Required

Pure LAN communication. Works without internet. Data never passes through third-party servers.

### Universal Terminal Control, Not Limited to Any Tool

Not just Claude Code. Any shell command, Python script, Git operation, Docker management... If the terminal can do it, your phone can do it.

### Multi-Session Parallel

Manage multiple terminal processes simultaneously. Create, switch, and close at will. One phone, multiple machines, multiple tasks.

### Fully Self-Controlled

Self-hosted, no data upload. No subscription, no OAuth, no internet relay. Your terminal, your rules.

### Harness Intelligence Mode

Built-in AI Agent Harness architecture:
- **Progressive Disclosure** — Load tool definitions on demand, 46.9% Token reduction
- **Output Compression** — Auto-compress long output, 26x Token efficiency
- **Progress Anchor** — Track long-running task progress, prevent drift
- **Token Monitoring** — 40% threshold warning

### tmux Session Persistence

Browser closed, phone locked, terminal still running. Reconnect and resume right where you left off. Supports native Linux tmux and Windows WSL + tmux.

### Mobile Optimized

- Capacitor Android native app
- Responsive Web UI for phone/tablet
- Virtual keyboard shortcuts (Ctrl+C, Tab, etc.)
- Dark theme

### Dashboard Monitoring

Built-in stats dashboard. Real-time view of connections, terminal count, auth logs, custom command usage.

## Architecture

```
┌─────────────┐     Socket.IO      ┌──────────────┐
│  Browser/App│ ◄──────────────► │   TakeLink   │
│  (xterm.js)  │    WebSocket      │   Server     │
└─────────────┘                    │              │
                                   │  node-pty    │
                                   │  process     │
┌─────────────┐     Socket.IO      │  manager     │
│  Another     │ ◄──────────────► │              │
│  device      │                   │  Harness     │
└─────────────┘                    │  Stats       │
                                   └──────┬───────┘
                                          │
                                   ┌──────▼───────┐
                                   │  PTY / tmux  │
                                   │  terminal    │
                                   └──────────────┘
```

## Tech Stack

- **Backend**: Node.js + Express + Socket.IO + node-pty
- **Frontend**: xterm.js + vanilla JS
- **Mobile**: Capacitor (Android)
- **Persistence**: tmux (Linux/WSL)
- **AI Optimization**: Harness mode (progressive disclosure, output compression, progress anchors)

## License

MIT
