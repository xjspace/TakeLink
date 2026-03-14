# LAN Happy - 局域网远程控制 Claude Code

> 手机端直接控制电脑上的 Claude Code，无需云端服务器，零延迟，完全私密。

## 架构

```
┌─────────────────┐              ┌─────────────────────┐
│   手机 App      │  ←─ WebSocket ──→ │      电脑 CLI       │
│  (React Native) │              │                     │
│                 │              │  HTTP Server :8080  │
│  输入地址连接    │              │  WebSocket Server   │
│  发送/接收消息   │              │  Claude 进程管理    │
└─────────────────┘              └─────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │   Claude Code CLI   │
                              └─────────────────────┘
```

## 快速开始

### 1. 电脑端 (CLI)

**Windows:**
```bash
cd G:\lan-happy\cli
start.bat          # 双击运行，自动安装依赖并启动
```

**Mac/Linux:**
```bash
cd lan-happy/cli
./start.sh         # 自动安装依赖并启动
```

**或手动运行:**
```bash
cd cli
pnpm install
pnpm dev
```

运行后会显示 QR 码：

```
🚀 LAN Happy - 局域网远程控制 Claude Code
────────────────────────────────────────

📱 手机扫描二维码连接:

████████████████
████████████████
███ ██ ███ █ ███
...

   手机端: http://192.168.1.100:8080/app
   桌面端: http://192.168.1.100:8080

────────────────────────────────────────
```

### 2. 手机端

**方式一：浏览器直接打开 (推荐)**

1. 确保手机和电脑在同一 WiFi
2. 手机浏览器打开 `http://192.168.1.100:8080/app`
3. 开始对话！

**方式二：Expo App (可选)**

```bash
cd app
pnpm install
pnpm start
```

然后在手机 Expo Go 中打开。

### 3. 桌面浏览器测试

电脑或其他设备打开 `http://192.168.1.100:8080` 即可测试。

## 项目结构

```
lan-happy/
├── cli/                    # 电脑端
│   ├── src/
│   │   └── index.ts       # 主程序
│   ├── package.json
│   └── tsconfig.json
├── app/                    # 手机端 (Expo)
│   ├── app/
│   │   ├── _layout.tsx    # 路由布局
│   │   ├── index.tsx      # 连接页面
│   │   └── session.tsx    # 会话页面
│   ├── package.json
│   └── app.json
└── README.md
```

## 功能特性

- ✅ 局域网直连，无需云端
- ✅ QR 码扫描连接
- ✅ 实时消息收发
- ✅ 支持多手机同时连接
- ✅ 浏览器直接测试
- ✅ 本地终端也可输入
- ✅ 零延迟 (<10ms)
- ✅ 完全私密（数据不离开局域网）
- ✅ 终端彩色输出（ANSI 支持）
- ✅ 多终端管理（启动/选择/切换）

## 配置

默认启动命令为 `claude`，可通过环境变量自定义：

```bash
# Windows
set CLAUDE_COMMAND=g:\my-script.bat
pnpm dev

# Mac/Linux
CLAUDE_COMMAND=/path/to/script pnpm dev
```

## 扩展方向

1. **端到端加密**: 添加 TweetNaCl 加密
2. **文件传输**: 支持发送文件
3. **会话历史**: 本地保存对话记录
4. **多代理支持**: 支持 Codex、Gemini
5. **推送通知**: 后台时接收通知
6. **语音输入**: 语音转文字

## 对比 Happy Coder

| 特性 | Happy Coder | LAN Happy |
|------|-------------|-----------|
| 云端服务器 | 需要 | 不需要 |
| 外网访问 | 支持 | 不支持（或内网穿透） |
| 延迟 | 100-500ms | <10ms |
| 部署复杂度 | 高 | 低 |
| 隐私 | 数据经过云端 | 数据不离开局域网 |
| 推送通知 | 支持 | 需要保持连接 |

## 许可证

MIT
