/**
 * TakeLink - 局域网远程终端，随时随地接管你的终端
 *
 * 支持浏览器关闭后会话持久化 (tmux/WSL+tmux)
 *
 * Harness 模式集成：
 * - 渐进式披露：延迟加载自定义命令
 * - 输出压缩：自动压缩长输出
 * - 进度锚点：追踪进程操作状态
 * - Token 监控：40% 阈值警告
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn, IPty } from 'node-pty';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

// Harness 模式组件
import { harnessEnhancer, toolRegistry } from './harness/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ 配置 ============
import dotenv from 'dotenv';
dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');
const HOST = '::'; // 同时监听 IPv4 和 IPv6
const AUTH_PASSWORD = process.env.PASSWORD || '';
const USE_TMUX = process.env.USE_TMUX !== 'false';
const TMUX_SESSION_PREFIX = 'takelink';
const WSL_DISTRIBUTION = process.env.WSL_DISTRIBUTION || '';

const DEFAULT_SHELL = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
const CLAUDE_CONFIG = {
  command: process.env.CLAUDE_COMMAND || DEFAULT_SHELL,
  env: {}
};

// 默认工作目录（处理反斜杠转义）
const DEFAULT_CWD = (process.env.DEFAULT_CWD || '').replace(/\\\\/g, '\\') || process.cwd();

// 解析自定义命令
// 格式: 名称:命令,名称:命令
interface CustomCommand {
  name: string;
  cmd: string;
}
function parseCustomCommands(envValue: string | undefined): CustomCommand[] {
  if (!envValue) return [];
  return envValue.split(',').map(item => {
    const colonIndex = item.indexOf(':');
    if (colonIndex === -1) return { name: item.trim(), cmd: item.trim() };
    return {
      name: item.substring(0, colonIndex).trim(),
      cmd: item.substring(colonIndex + 1).trim()
    };
  }).filter(c => c.name && c.cmd);
}
const CUSTOM_COMMANDS = parseCustomCommands(process.env.CUSTOM_COMMANDS);

// ============ Harness 初始化 ============
// 注册自定义命令到工具注册表（渐进式披露）
toolRegistry.registerCustomCommands(CUSTOM_COMMANDS);
console.log(chalk.gray(`[Harness] 已注册 ${CUSTOM_COMMANDS.length} 个自定义命令（延迟加载模式）`));

// ============ 工具函数 ============
function killProcessOnPort(port: number): boolean {
  // 参数验证：确保端口是有效的整数
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.log(chalk.yellow(`⚠️  无效的端口号: ${port}`));
    return false;
  }

  try {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    for (const line of result.trim().split('\n')) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        // 验证 PID 是纯数字，防止命令注入
        if (pid && /^\d+$/.test(pid)) {
          console.log(chalk.yellow(`⚠️  端口 ${port} 被占用，正在终止 PID:${pid}...`));
          execSync(`taskkill /F /PID ${pid}`);
          return true;
        }
      }
    }
  } catch {
    // 端口未被占用是正常情况
  }
  return false;
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets!) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function getLocalIPv6(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets!) {
      // 获取公网 IPv6 地址（240e/240x 开头的是中国运营商分配的）
      if (net.family === 'IPv6' && !net.internal &&
          (net.address.startsWith('240') || net.address.startsWith('2'))) {
        return net.address;
      }
    }
  }
  return null;
}

// Windows 路径转 WSL 路径
function convertToWslPath(winPath: string): string {
  return winPath
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, letter) => `/mnt/${letter.toLowerCase()}`);
}

// ============ tmux 工具函数 (跨平台) ============
interface TmuxInfo {
  available: boolean;
  useWsl: boolean;
  distribution: string;
}

function checkTmuxAvailable(): TmuxInfo {
  // Linux/Mac 直接检测
  if (process.platform !== 'win32') {
    try {
      execSync('which tmux', { encoding: 'utf-8' });
      return { available: true, useWsl: false, distribution: '' };
    } catch {
      return { available: false, useWsl: false, distribution: '' };
    }
  }

  // Windows: 检测 WSL + tmux
  try {
    execSync('wsl --list --quiet', { encoding: 'utf-8' });
    let distro = WSL_DISTRIBUTION;
    if (!distro) {
      const listResult = execSync('wsl --list --quiet', { encoding: 'utf-8' });
      distro = listResult.trim().split('\n')[0].trim();
    }

    // 检测 tmux 是否安装
    try {
      execSync(`wsl -d ${distro} which tmux`, { encoding: 'utf-8' });
      return { available: true, useWsl: true, distribution: distro };
    } catch {
      return { available: false, useWsl: false, distribution: '' };
    }
  } catch {
    return { available: false, useWsl: false, distribution: '' };
  }
}

function getWslPrefix(distribution: string): string {
  return distribution ? `wsl -d ${distribution}` : 'wsl';
}

function getTmuxSessions(info: TmuxInfo): string[] {
  try {
    let cmd: string;
    if (info.useWsl) {
      const prefix = getWslPrefix(info.distribution);
      cmd = `${prefix} tmux list-sessions -F "#{session_name}" 2>/dev/null`;
    } else {
      cmd = 'tmux list-sessions -F "#{session_name}" 2>/dev/null';
    }
    const result = execSync(cmd, { encoding: 'utf-8' });
    return result.trim().split('\n').filter(s => s.startsWith(TMUX_SESSION_PREFIX));
  } catch {
    return [];
  }
}

function createTmuxSession(sessionName: string, cwd: string, info: TmuxInfo): boolean {
  try {
    let cmd: string;
    if (info.useWsl) {
      const prefix = getWslPrefix(info.distribution);
      const wslCwd = convertToWslPath(cwd);
      cmd = `${prefix} tmux new-session -d -s ${sessionName} -c "${wslCwd}" 2>/dev/null`;
    } else {
      cmd = `tmux new-session -d -s ${sessionName} -c "${cwd}" 2>/dev/null`;
    }
    execSync(cmd);
    return true;
  } catch {
    return false;
  }
}

function killTmuxSession(sessionName: string, info: TmuxInfo): boolean {
  try {
    let cmd: string;
    if (info.useWsl) {
      const prefix = getWslPrefix(info.distribution);
      cmd = `${prefix} tmux kill-session -t ${sessionName} 2>/dev/null`;
    } else {
      cmd = `tmux kill-session -t ${sessionName} 2>/dev/null`;
    }
    execSync(cmd);
    return true;
  } catch {
    return false;
  }
}

// ============ 进程管理（集成 Harness） ============
interface ClaudeProcess {
  id: string;
  cwd: string;
  projectName: string;
  pty: IPty;
  createdAt: number;
  tmuxSession?: string;
  isPersistent: boolean;
  /** Harness: 输出统计 */
  outputStats?: {
    totalChars: number;
    compressedChars: number;
    lastCompression: number;
  };
}

class ProcessManager {
  private processes = new Map<string, ClaudeProcess>();
  private callbacks = new Map<string, Map<string, (data: string) => void>>();
  private idCounter = 0;
  private useTmux: boolean;
  private tmuxInfo: TmuxInfo;
  /** Harness: 输出缓冲区 */
  private outputBuffers = new Map<string, string[]>();
  /** Harness: 压缩阈值（字符数） */
  private compressionThreshold = 10000;

  constructor() {
    this.tmuxInfo = checkTmuxAvailable();
    this.useTmux = USE_TMUX && this.tmuxInfo.available;

    if (this.tmuxInfo.available && USE_TMUX) {
      if (this.tmuxInfo.useWsl) {
        console.log(chalk.green(`✅ WSL + tmux 可用 (${this.tmuxInfo.distribution})，会话持久化已启用`));
      } else {
        console.log(chalk.green('✅ tmux 可用，会话持久化已启用'));
      }
      this.recoverTmuxSessions();
    } else if (USE_TMUX && !this.tmuxInfo.available) {
      if (process.platform === 'win32') {
        console.log(chalk.yellow('⚠️  WSL 或 tmux 不可用，会话将不会持久化'));
        console.log(chalk.gray('   提示: 安装 WSL 并运行 "wsl sudo apt install tmux" 以启用持久化'));
      } else {
        console.log(chalk.yellow('⚠️  tmux 不可用，会话将不会持久化'));
      }
    }
  }

  private recoverTmuxSessions() {
    const sessions = getTmuxSessions(this.tmuxInfo);
    if (sessions.length === 0) return;

    console.log(chalk.cyan(`🔄 发现 ${sessions.length} 个可恢复的 tmux 会话`));

    sessions.forEach(sessionName => {
      const id = `claude-${++this.idCounter}`;
      const projectName = sessionName.replace(`${TMUX_SESSION_PREFIX}-`, '');
      const pty = this.createTmuxPty(sessionName, process.cwd());

      const proc: ClaudeProcess = {
        id, cwd: process.cwd(), projectName, pty,
        createdAt: Date.now(), tmuxSession: sessionName, isPersistent: true,
      };

      this.processes.set(id, proc);
      this.callbacks.set(id, new Map());
      this.setupPtyCallbacks(pty, id, sessionName);
      console.log(chalk.green(`✅ 恢复会话: ${projectName} (${id})`));
    });
  }

  private createTmuxPty(sessionName: string, cwd: string): IPty {
    if (this.tmuxInfo.useWsl) {
      // WSL 模式
      const args = this.tmuxInfo.distribution
        ? ['-d', this.tmuxInfo.distribution, 'tmux', 'attach', '-t', sessionName]
        : ['tmux', 'attach', '-t', sessionName];
      return spawn('wsl', args, {
        name: 'xterm-256color', cols: 80, rows: 24, cwd,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });
    } else {
      // 原生 Linux/Mac 模式
      return spawn('tmux', ['attach', '-t', sessionName], {
        name: 'xterm-256color', cols: 80, rows: 24, cwd,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });
    }
  }

  private setupPtyCallbacks(pty: IPty, id: string, sessionName: string) {
    // Harness: 创建上下文管理器
    harnessEnhancer.createContext(id);

    pty.onData((data: string) => {
      // Harness: 处理输出（自动压缩）
      this.handleOutput(id, data);
      // 分发给客户端
      this.callbacks.get(id)?.forEach(cb => cb(data));
    });
    pty.onExit(({ exitCode }) => {
      console.log(chalk.gray(`[CLI] tmux 会话断开: ${sessionName} (code ${exitCode})`));
      // Harness: 清理资源
      harnessEnhancer.cleanup(id);
      this.outputBuffers.delete(id);
      this.processes.delete(id);
      this.callbacks.delete(id);
    });
  }

  /**
   * Harness: 处理输出（带压缩）
   */
  private handleOutput(processId: string, data: string): void {
    const proc = this.processes.get(processId);
    if (!proc) return;

    // 初始化统计
    if (!proc.outputStats) {
      proc.outputStats = { totalChars: 0, compressedChars: 0, lastCompression: 0 };
      this.outputBuffers.set(processId, []);
    }

    // 更新统计
    proc.outputStats.totalChars += data.length;

    // 添加到缓冲区
    const buffer = this.outputBuffers.get(processId);
    if (buffer) {
      buffer.push(data);

      // 检查是否需要压缩
      const totalLength = buffer.reduce((sum, s) => sum + s.length, 0);
      if (totalLength > this.compressionThreshold) {
        this.compressBuffer(processId);
      }
    }

    // 记录到 Harness 上下文
    harnessEnhancer.handleOutput(processId, data);
  }

  /**
   * Harness: 压缩缓冲区（保留最近 5 条完整）
   */
  private compressBuffer(processId: string): void {
    const buffer = this.outputBuffers.get(processId);
    const proc = this.processes.get(processId);
    if (!buffer || !proc || buffer.length <= 5) return;

    const recent = buffer.slice(-5);
    const older = buffer.slice(0, -5);

    // 压缩旧输出为摘要
    const compressed = older.map(s => {
      const clean = s.replace(/\x1b\[[0-9;]*m/g, '').trim();
      return clean.length > 100 ? clean.slice(0, 97) + '...' : clean;
    });

    // 更新统计
    const savedChars = older.reduce((sum, s) => sum + s.length, 0) -
                       compressed.reduce((sum, s) => sum + s.length, 0);
    proc.outputStats!.compressedChars += savedChars;
    proc.outputStats!.lastCompression = Date.now();

    // 更新缓冲区
    this.outputBuffers.set(processId, [`[... ${compressed.length} 条已压缩，节省 ${savedChars} 字符 ...]`, ...recent]);
  }

  startProcess(cwd: string): ClaudeProcess {
    const id = `claude-${++this.idCounter}`;
    const projectName = path.basename(cwd);
    const tmuxSession = `${TMUX_SESSION_PREFIX}-${id}`;

    console.log(chalk.gray(`[CLI] 启动: ${projectName} (${cwd})`));

    let pty: IPty;
    let isPersistent = false;

    if (this.useTmux) {
      console.log(chalk.gray(`[CLI] 使用 tmux 会话: ${tmuxSession}`));
      createTmuxSession(tmuxSession, cwd, this.tmuxInfo);
      pty = this.createTmuxPty(tmuxSession, cwd);
      this.setupPtyCallbacks(pty, id, tmuxSession);
      isPersistent = true;
    } else {
      console.log(chalk.gray(`[CLI] 命令: ${CLAUDE_CONFIG.command}`));
      const isBat = CLAUDE_CONFIG.command.toLowerCase().endsWith('.bat') ||
                    CLAUDE_CONFIG.command.toLowerCase().endsWith('.cmd');

      pty = spawn(
        isBat ? 'cmd.exe' : CLAUDE_CONFIG.command,
        isBat ? ['/c', CLAUDE_CONFIG.command] : [],
        {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd,
          env: {
            ...process.env,
            ...CLAUDE_CONFIG.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            PYTHONIOENCODING: 'utf-8',
            LANG: 'en_US.UTF-8',
            // Windows 下禁用一些可能导致问题的序列
            PROMPT: '$P$G',
            CLINK_NOANSI: '1',
          },
          // Windows 下使用 Conpty
          useConpty: true,
          useConptyCascadia: false,
        } as any
      );

      // 统一使用回调机制，集成 Harness
      // Harness: 创建上下文
      harnessEnhancer.createContext(id);
      this.outputBuffers.set(id, []);

      pty.onData((data: string) => {
        // Harness: 处理输出
        this.handleOutput(id, data);
        // 分发给客户端
        this.callbacks.get(id)?.forEach(cb => cb(data));
      });
      pty.onExit(({ exitCode }) => {
        console.log(chalk.gray(`[CLI] 退出: ${id} (code ${exitCode})`));
        // Harness: 清理资源
        harnessEnhancer.cleanup(id);
        this.outputBuffers.delete(id);
        this.processes.delete(id);
        this.callbacks.delete(id);
      });
    }

    const proc: ClaudeProcess = {
      id, cwd, projectName, pty,
      createdAt: Date.now(),
      tmuxSession: this.useTmux ? tmuxSession : undefined,
      isPersistent,
    };

    this.processes.set(id, proc);
    this.callbacks.set(id, new Map());

    return proc;
  }

  getProcesses() { return Array.from(this.processes.values()); }
  getProcess(id: string) { return this.processes.get(id); }

  sendInput(id: string, data: string): boolean {
    const proc = this.processes.get(id);
    if (!proc) return false;
    proc.pty.write(data);
    return true;
  }

  registerCallback(processId: string, socketId: string, callback: (data: string) => void) {
    let map = this.callbacks.get(processId);
    if (!map) { map = new Map(); this.callbacks.set(processId, map); }
    map.set(socketId, callback);
  }

  unregisterCallback(processId: string, socketId: string) {
    this.callbacks.get(processId)?.delete(socketId);
  }

  killProcess(id: string, destroySession: boolean = false): boolean {
    const proc = this.processes.get(id);
    if (!proc) return false;
    try {
      proc.pty.kill();
      if (destroySession && proc.tmuxSession) {
        killTmuxSession(proc.tmuxSession, this.tmuxInfo);
      }
      this.processes.delete(id);
      this.callbacks.delete(id);
      return true;
    } catch { return false; }
  }

  resizeProcess(id: string, cols: number, rows: number): boolean {
    const proc = this.processes.get(id);
    if (!proc) return false;
    try { proc.pty.resize(cols, rows); return true; } catch { return false; }
  }

  killAll(destroySessions: boolean = false) {
    this.processes.forEach(proc => {
      try {
        proc.pty.kill();
        if (destroySessions && proc.tmuxSession) {
          killTmuxSession(proc.tmuxSession, this.tmuxInfo);
        }
      } catch {}
    });
    this.processes.clear();
    this.callbacks.clear();
    // Harness: 清理所有上下文
    this.outputBuffers.clear();
    harnessEnhancer.getActiveProcessIds().forEach((id: string) => harnessEnhancer.cleanup(id));
  }

  /**
   * Harness: 获取进程统计信息
   */
  getProcessStats(id: string): {
    outputStats?: ClaudeProcess['outputStats'];
    contextSummary: ReturnType<typeof harnessEnhancer.getContextSummary>;
  } | null {
    const proc = this.processes.get(id);
    if (!proc) return null;
    return {
      outputStats: proc.outputStats,
      contextSummary: harnessEnhancer.getContextSummary(id),
    };
  }
}

// ============ 主程序 ============
async function main() {
  killProcessOnPort(PORT);

  const localIP = getLocalIP();
  const app = express();
  const httpServer = createServer(app);

  // CORS 配置 - 仅允许局域网和本地访问
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // 允许无 origin 的请求（如原生应用）和局域网/本地请求
        // Capacitor: file://, https://localhost, capacitor://localhost
        if (!origin ||
            origin.startsWith('http://192.168.') ||
            origin.startsWith('http://10.') ||
            origin.startsWith('http://172.') ||
            origin.startsWith('http://127.0.0.1') ||
            origin.startsWith('http://localhost') ||
            origin.startsWith('https://localhost') ||
            origin.startsWith('capacitor://') ||
            origin.startsWith('ionic://') ||
            origin.startsWith('file://') ||
            origin.startsWith('http://[::1]') ||
            origin.startsWith('http://[2')) { // IPv6
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }
  });

  const processManager = new ProcessManager();

  // 静态文件
  app.use(express.static(join(process.cwd(), 'public')));
  app.use('/node_modules', express.static(join(process.cwd(), 'node_modules')));
  app.get('/app', (req, res) => res.sendFile(join(process.cwd(), 'public/app.html')));
  app.get('/', (req, res) => res.redirect('/app'));

  // Harness API: 获取系统统计
  app.get('/api/harness/stats', (req, res) => {
    const toolStats = toolRegistry.getStats();
    const processes = processManager.getProcesses().map(p => ({
      id: p.id,
      projectName: p.projectName,
      stats: processManager.getProcessStats(p.id),
    }));
    res.json({
      tools: toolStats,
      processes,
      timestamp: Date.now(),
    });
  });

  // 认证 token 存储
  const authTokens = new Map<string, { ip: string; createdAt: number }>();
  const TOKEN_EXPIRE = 24 * 60 * 60 * 1000; // 24小时过期

  // 生成 token (使用密码学安全的随机数)
  function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // 验证 token
  function validateToken(token: string, ip: string): boolean {
    const data = authTokens.get(token);
    if (!data) return false;
    if (Date.now() - data.createdAt > TOKEN_EXPIRE) {
      authTokens.delete(token);
      return false;
    }
    return true;
  }

  // WebSocket 事件
  io.on('connection', (socket) => {
    let clientIp = 'unknown';

    // 获取客户端 IP
    const forwardedFor = socket.request.headers['x-forwarded-for'];
    if (forwardedFor) {
      clientIp = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',')[0].trim();
    } else if (socket.conn?.remoteAddress) {
      clientIp = socket.conn.remoteAddress;
    } else if (socket.request.socket?.remoteAddress) {
      clientIp = socket.request.socket.remoteAddress;
    } else if (socket.handshake.address) {
      clientIp = socket.handshake.address;
    }

    clientIp = clientIp.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
    console.log(chalk.green(`📱 已连接 [${clientIp}]`));

    // 认证
    let isAuthenticated = !AUTH_PASSWORD;
    socket.emit('auth-required', { required: !!AUTH_PASSWORD });

    // token 认证
    socket.on('auth-token', (token: string, callback?: (result: { success: boolean }) => void) => {
      if (!AUTH_PASSWORD) {
        isAuthenticated = true;
        callback?.({ success: true });
        return;
      }
      if (validateToken(token, clientIp)) {
        isAuthenticated = true;
        console.log(chalk.green(`✅ Token 认证成功 [${clientIp}]`));
        callback?.({ success: true });
      } else {
        callback?.({ success: false });
      }
    });

    // 密码认证
    socket.on('auth', (password: string, callback?: (result: { success: boolean; error?: string; token?: string }) => void) => {
      if (!AUTH_PASSWORD) { isAuthenticated = true; callback?.({ success: true }); return; }
      if (password === AUTH_PASSWORD) {
        isAuthenticated = true;
        const token = generateToken();
        authTokens.set(token, { ip: clientIp, createdAt: Date.now() });
        console.log(chalk.green(`✅ 认证成功 [${clientIp}]`));
        callback?.({ success: true, token });
      } else {
        console.log(chalk.red(`❌ 认证失败 [${clientIp}]`));
        callback?.({ success: false, error: '密码错误' });
      }
    });

    const checkAuth = (eventName: string): boolean => {
      if (!isAuthenticated && AUTH_PASSWORD) {
        console.log(chalk.yellow(`⚠️  未认证请求: ${eventName} [${clientIp}]`));
        return false;
      }
      return true;
    };

    socket.emit('client-info', {
      ip: clientIp,
      id: socket.id,
      customCommands: CUSTOM_COMMANDS,
      // Harness: 发送工具统计
      harnessStats: toolRegistry.getStats(),
    });

    socket.on('ready', () => {
      if (!checkAuth('ready')) return;
      const processes = processManager.getProcesses().map(p => ({
        id: p.id, cwd: p.cwd, projectName: p.projectName, createdAt: p.createdAt
      }));
      socket.emit('processes-list', processes);
    });

    // 当前 socket 关注的进程 ID
    let currentProcessId: string | null = null;

    socket.on('start-process', (data: { cwd?: string }) => {
      if (!checkAuth('start-process')) return;

      // 注销旧的回调
      if (currentProcessId) {
        processManager.unregisterCallback(currentProcessId, socket.id);
      }

      // 使用配置的默认目录，确保目录存在
      let cwd = data?.cwd || DEFAULT_CWD;
      if (!fs.existsSync(cwd)) {
        console.log(chalk.yellow(`⚠️  目录不存在 ${cwd}，使用项目目录`));
        cwd = process.cwd();
      }
      const proc = processManager.startProcess(cwd);

      // 注册新的回调
      currentProcessId = proc.id;
      processManager.registerCallback(proc.id, socket.id, (output) => {
        socket.emit('claude-output', { id: proc.id, output });
      });

      socket.emit('process-started', { id: proc.id, cwd: proc.cwd, projectName: proc.projectName });
      io.emit('processes-updated', processManager.getProcesses().map(p => ({
        id: p.id, cwd: p.cwd, projectName: p.projectName, createdAt: p.createdAt
      })));
    });

    // 执行自定义命令
    socket.on('run-custom-command', (cmd: string) => {
      if (!checkAuth('run-custom-command')) return;
      if (currentProcessId) {
        // 将双反斜杠替换为单反斜杠（.env 文件中需要用 \\ 表示 \）
        const normalizedCmd = cmd.replace(/\\\\/g, '\\');
        // 生产环境脱敏日志
        if (process.env.NODE_ENV !== 'production') {
          const displayCmd = normalizedCmd.length > 50
            ? normalizedCmd.slice(0, 47) + '...'
            : normalizedCmd;
          console.log(chalk.cyan(`[CMD] 执行: ${displayCmd}`));
        }
        processManager.sendInput(currentProcessId, normalizedCmd + '\r');
      }
    });

    socket.on('select-process', (processId: string) => {
      if (!checkAuth('select-process')) return;

      // 注销旧的回调
      if (currentProcessId && currentProcessId !== processId) {
        processManager.unregisterCallback(currentProcessId, socket.id);
      }

      const proc = processManager.getProcess(processId);
      if (proc) {
        currentProcessId = processId;
        processManager.registerCallback(processId, socket.id, (output) => {
          socket.emit('claude-output', { id: processId, output });
        });
        socket.emit('process-selected', { success: true, process: { id: proc.id, cwd: proc.cwd, projectName: proc.projectName } });
      } else {
        socket.emit('process-selected', { success: false, error: '进程不存在' });
      }
    });

    socket.on('terminal-input', (data: { id: string; data: string }, callback?: (ack: any) => void) => {
      if (!checkAuth('terminal-input')) { callback?.({ success: false, error: 'unauthorized' }); return; }
      if (data.id && data.data) {
        const result = processManager.sendInput(data.id, data.data);
        callback?.({ success: result, id: data.id });
      } else {
        callback?.({ success: false, error: 'missing data' });
      }
    });

    socket.on('resize', (data: { id: string; cols: number; rows: number }) => {
      if (!checkAuth('resize')) return;
      if (data.id && data.cols && data.rows) processManager.resizeProcess(data.id, data.cols, data.rows);
    });

    socket.on('kill-process', (processId: string) => {
      if (!checkAuth('kill-process')) return;
      if (processManager.killProcess(processId)) {
        io.emit('processes-updated', processManager.getProcesses().map(p => ({
          id: p.id, cwd: p.cwd, projectName: p.projectName, createdAt: p.createdAt
        })));
      }
    });

    // Harness: 获取进程统计信息
    socket.on('get-process-stats', (processId: string, callback?: (result: any) => void) => {
      if (!checkAuth('get-process-stats')) return;
      const stats = processManager.getProcessStats(processId);
      callback?.(stats);
    });

    // Harness: 获取系统统计信息
    socket.on('get-harness-stats', (callback?: (result: any) => void) => {
      if (!checkAuth('get-harness-stats')) return;
      callback?.({
        tools: toolRegistry.getStats(),
        activeProcesses: harnessEnhancer.getActiveProcessIds().length,
      });
    });

    socket.on('disconnect', () => {
      console.log(chalk.gray(`📱 已断开 [${clientIp}]`));
      processManager.getProcesses().forEach(proc => {
        processManager.unregisterCallback(proc.id, socket.id);
      });
    });
  });

  // 启动
  httpServer.listen(PORT, HOST, () => {
    const localIPv4 = localIP;
    const localIPv6 = getLocalIPv6();

    console.log('');
    console.log(chalk.bold.cyan('🚀 TakeLink'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');

    // IPv4 局域网地址
    const ipv4Url = `http://${localIPv4}:${PORT}/app`;
    console.log(chalk.white(`📡 IPv4 (局域网):`));
    qrcode.generate(ipv4Url, { small: true });
    console.log(chalk.cyan(`   ${ipv4Url}`));
    console.log('');

    // IPv6 公网地址
    if (localIPv6) {
      const ipv6Url = `http://[${localIPv6}]:${PORT}/app`;
      console.log(chalk.white(`🌐 IPv6 (公网):`));
      qrcode.generate(ipv6Url, { small: true });
      console.log(chalk.cyan(`   ${ipv6Url}`));
      console.log('');
    }

    console.log(chalk.gray('─'.repeat(50)));
    console.log('');
  });

  // 退出
  const cleanup = () => {
    processManager.killAll();
    httpServer.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch(console.error);
