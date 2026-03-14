/**
 * API 层 - 与 CLI 端通信
 */

import { io, Socket } from 'socket.io-client';
import { Message, Session, RPCResponse, APIEvent } from '../types/message';

type EventListener = (event: APIEvent) => void;

class ApiClient {
  private socket: Socket | null = null;
  private listeners: Set<EventListener> = new Set();

  // 连接服务器
  connect(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      });

      this.socket.on('connect', () => {
        console.log('[API] 已连接');
        resolve(this.socket!.id || 'connected');
      });

      this.socket.on('connect_error', (err) => {
        console.log('[API] 连接错误:', err.message);
      });

      this.socket.on('disconnect', () => {
        console.log('[API] 已断开');
      });

      // 注册事件监听
      this.setupEventHandlers();
    });
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // 会话创建
    this.socket.on('session-created', (session: Session) => {
      this.emit({ type: 'session-created', session });
    });

    // 会话更新
    this.socket.on('session-updated', (session: Session) => {
      this.emit({ type: 'session-updated', session });
    });

    // 新消息
    this.socket.on('message', (data: { sessionId: string; message: Message }) => {
      this.emit({ type: 'message', sessionId: data.sessionId, message: data.message });
    });

    // 工具状态更新
    this.socket.on('tool-update', (data: { sessionId: string; toolId: string; status: string; result?: string }) => {
      this.emit({
        type: 'tool-update',
        sessionId: data.sessionId,
        toolId: data.toolId,
        status: data.status as any,
        result: data.result
      });
    });
  }

  // RPC 调用
  async rpc<T>(method: string, params?: any): Promise<T> {
    if (!this.socket) throw new Error('未连接');

    const response = await this.socket.emitWithAck('rpc', { method, params });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data as T;
  }

  // 发送消息
  async sendMessage(sessionId: string, text: string): Promise<Message> {
    return this.rpc<Message>('sendMessage', { sessionId, text });
  }

  // 创建新会话
  async createSession(cwd?: string): Promise<Session> {
    return this.rpc<Session>('createSession', { cwd });
  }

  // 获取会话列表
  async getSessions(): Promise<Session[]> {
    return this.rpc<Session[]>('getSessions');
  }

  // 事件监听
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: APIEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 获取连接状态
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const api = new ApiClient();
