/**
 * API 层 - 与 CLI 端通信
 * 匹配服务端 Socket.IO 事件协议
 */

import { io, Socket } from 'socket.io-client';

type EventListener = (event: any) => void;

interface ProcessInfo {
  id: string;
  cwd: string;
  projectName: string;
  createdAt: number;
}

class ApiClient {
  private socket: Socket | null = null;
  private listeners: Set<EventListener> = new Set();
  private currentProcessId: string | null = null;

  // 连接服务器
  connect(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Socket.IO 用 URL 的 origin 作为连接地址
      // 传入的可能带 /app 路径，必须去掉，否则会请求 /app/socket.io/ 而非 /socket.io/
      let socketUrl = url;
      try {
        const parsed = new URL(url);
        socketUrl = parsed.origin; // 只保留 http://host:port
      } catch (e) {
        // URL 解析失败，原样使用
      }
      console.log('[API] 连接地址:', socketUrl, '(原始:', url, ')');

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 15000,
      });

      this.socket.on('connect', () => {
        console.log('[API] Socket 已连接:', this.socket?.id);
        resolve(this.socket!.id || 'connected');
      });

      this.socket.on('connect_error', (err: any) => {
        console.log('[API] 连接错误:', err.message || err);
        reject(err);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[API] 连接断开:', reason);
        this.emit({ type: 'disconnected', reason });
      });

      // 注册服务端事件
      this.setupServerEventHandlers();
    });
  }

  private setupServerEventHandlers() {
    if (!this.socket) return;

    // 客户端信息
    this.socket.on('client-info', (info: any) => {
      console.log('[API] 客户端信息:', info.ip);
      this.emit({ type: 'client-info', info });
    });

    // 进程列表
    this.socket.on('processes-list', (processes: ProcessInfo[]) => {
      console.log('[API] 进程列表:', processes.length);
      this.emit({ type: 'processes-list', processes });
    });

    // 进程已启动
    this.socket.on('process-started', (data: { id: string; cwd: string; projectName: string }) => {
      console.log('[API] 进程已启动:', data.projectName);
      this.currentProcessId = data.id;
      this.emit({
        type: 'process-started',
        session: {
          id: data.id,
          cwd: data.cwd,
          projectName: data.projectName,
          messages: [],
          createdAt: Date.now(),
        },
      });
    });

    // 终端输出
    this.socket.on('claude-output', (data: { id: string; output: string }) => {
      this.emit({
        type: 'terminal-output',
        processId: data.id,
        output: data.output,
      });
    });

    // 进程列表更新
    this.socket.on('processes-updated', (processes: ProcessInfo[]) => {
      this.emit({ type: 'processes-updated', processes });
    });

    // 认证要求
    this.socket.on('auth-required', (data: { required: boolean }) => {
      if (data.required) {
        this.emit({ type: 'auth-required' });
      }
    });
  }

  // 发送 ready 事件，获取进程列表
  ready() {
    if (!this.socket) return;
    this.socket.emit('ready');
  }

  // 启动新终端进程
  startProcess(cwd?: string) {
    if (!this.socket) return;
    this.socket.emit('start-process', { cwd });
  }

  // 发送终端输入
  sendTerminalInput(data: string) {
    if (!this.socket || !this.currentProcessId) return;
    this.socket.emit('terminal-input', {
      id: this.currentProcessId,
      data,
    });
  }

  // 调整终端大小
  resize(cols: number, rows: number) {
    if (!this.socket || !this.currentProcessId) return;
    this.socket.emit('resize', {
      id: this.currentProcessId,
      cols,
      rows,
    });
  }

  // 认证
  auth(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: '未连接' });
        return;
      }
      this.socket.emit('auth', password, (result: any) => {
        resolve(result || { success: false });
      });
    });
  }

  // 事件监听
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: any) {
    this.listeners.forEach(listener => listener(event));
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentProcessId = null;
  }

  // 获取连接状态
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get processId(): string | null {
    return this.currentProcessId;
  }
}

export const api = new ApiClient();
