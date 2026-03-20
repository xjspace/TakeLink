# TakeLink - LAN Remote Terminal for Claude Code

> Control Claude Code on your computer from your phone. Zero latency, fully private, no cloud server required.

[中文文档](README_CN.md)

## Architecture

```
┌─────────────────┐              ┌─────────────────────┐
│   Mobile App    │  ←─ WebSocket ──→ │      PC CLI         │
│  (Capacitor)    │              │                     │
│                 │              │  HTTP Server :8080  │
│  Scan to connect│              │  WebSocket Server   │
│  Send/receive   │              │  Claude management  │
└─────────────────┘              └─────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │   Claude Code CLI   │
                              └─────────────────────┘
```

## Quick Start

### 1. PC Side (CLI)

**Windows:**
```bash
cd TakeLink\cli
start.bat          # Double-click to run
```

**Mac/Linux:**
```bash
cd TakeLink/cli
./start.sh         # Auto install deps and start
```

**Or manually:**
```bash
cd cli
pnpm install
pnpm dev
```

After running, you'll see a QR code:

```
🚀 TakeLink - LAN Remote Terminal
────────────────────────────────────────

📱 Scan QR code to connect:

████████████████
████████████████
███ ██ ███ █ ███
...

   Mobile: http://192.168.1.100:8080/app
   Desktop: http://192.168.1.100:8080

────────────────────────────────────────
```

### 2. Mobile Side

**Option 1: Browser (Recommended)**

1. Connect phone and PC to the same WiFi
2. Open `http://192.168.1.100:8080/app` on phone
3. Start chatting!

**Option 2: Capacitor App (Android)**

```bash
cd cli
pnpm run cap:build
# Build APK in Android Studio
```

### 3. Desktop Browser Testing

Open `http://192.168.1.100:8080` on any device to test.

## Project Structure

```
TakeLink/
├── cli/                    # PC Side
│   ├── src/
│   │   └── index.ts       # Main program
│   ├── public/            # Web assets
│   ├── package.json
│   └── tsconfig.json
├── android/                # Android App (generated)
└── README.md
```

## Features

- Direct LAN connection, no cloud needed
- QR code scanning
- Real-time messaging
- Multiple phone connections
- Browser testing support
- Local terminal input
- Zero latency (<10ms)
- Fully private (data stays on LAN)
- ANSI color output
- Multi-terminal management

## Configuration

Default command is `claude`, customize via environment variable:

```bash
# Windows
set CLAUDE_COMMAND=g:\my-script.bat
pnpm dev

# Mac/Linux
CLAUDE_COMMAND=/path/to/script pnpm dev
```

## Roadmap

1. **E2E Encryption**: Add TweetNaCl encryption
2. **File Transfer**: Send files between devices
3. **Session History**: Local conversation storage
4. **Multi-Agent**: Support Codex, Gemini
5. **Push Notifications**: Background alerts
6. **Voice Input**: Speech to text

## Acknowledgments

Inspired by Happy Code, Claude TUI and other excellent projects.

## Version

v1.1.9

## License

MIT
