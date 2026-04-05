/**
 * ApiClient (socket.ts) 单元测试
 */

// Mock socket.io-client - 在 factory 内部完成所有 mock 逻辑
jest.mock('socket.io-client', () => {
  // 使用简单的自定义 EventEmitter 替代 Node.js EventEmitter
  class MockEmitter {
    private handlers: Record<string, Function[]> = {};
    on(event: string, handler: Function) {
      if (!this.handlers[event]) this.handlers[event] = [];
      this.handlers[event].push(handler);
      return this;
    }
    emit(event: string, ...args: any[]) {
      (this.handlers[event] || []).forEach(h => h(...args));
    }
    removeAllListeners() {
      this.handlers = {};
    }
  }

  const mockEmitter = new MockEmitter();

  const mockSocketObj = {
    id: 'mock-socket-id',
    connected: false,
    on: jest.fn((event: string, handler: Function) => mockEmitter.on(event, handler)),
    emit: jest.fn(),
    emitWithAck: jest.fn(),
    disconnect: jest.fn(() => {
      mockSocketObj.connected = false;
      mockEmitter.emit('disconnect');
    }),
    connect: jest.fn(),
    // 内部辅助：触发事件
    _trigger: (event: string, ...args: any[]) => mockEmitter.emit(event, ...args),
    _clear: () => mockEmitter.removeAllListeners(),
  };

  // 挂载到 global 方便测试访问
  (global as any).__mockSocket = mockSocketObj;

  const mockIoFn = jest.fn(() => {
    mockSocketObj.connected = false;
    return mockSocketObj;
  });

  return { io: mockIoFn };
});

import { api } from '../../api/socket';

// 获取 mock socket 的辅助函数
function getMockSocket() {
  return (global as any).__mockSocket;
}

// 触发 socket 事件
function emitSocketEvent(event: string, ...args: any[]) {
  getMockSocket()._trigger(event, ...args);
}

// 连接并等待完成
async function connectAndWait(url = 'http://localhost:8080') {
  const promise = api.connect(url);
  // 模拟 socket.io 连接成功：设置 connected 并触发事件
  getMockSocket().connected = true;
  emitSocketEvent('connect');
  return promise;
}

beforeEach(() => {
  const ms = getMockSocket();
  ms._clear();
  ms.on.mockClear();
  ms.emit.mockClear();
  ms.emitWithAck.mockClear();
  ms.disconnect.mockClear();
  ms.connected = false;

  try { api.disconnect(); } catch {}
});

describe('ApiClient', () => {
  describe('connect', () => {
    it('应该创建 socket 连接并返回 socket id', async () => {
      const id = await connectAndWait();
      expect(id).toBe('mock-socket-id');
    });

    it('应该传入正确的传输配置', async () => {
      await connectAndWait();
      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith('http://localhost:8080', expect.objectContaining({
        transports: ['websocket'],
      }));
    });

    it('应该注册事件处理器', async () => {
      await connectAndWait();
      const ms = getMockSocket();
      expect(ms.on).toHaveBeenCalledWith('session-created', expect.any(Function));
      expect(ms.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(ms.on).toHaveBeenCalledWith('tool-update', expect.any(Function));
    });
  });

  describe('rpc', () => {
    it('应该通过 emitWithAck 发送 RPC 请求', async () => {
      await connectAndWait();
      const ms = getMockSocket();

      ms.emitWithAck.mockResolvedValue({ data: { id: 'test' } });
      const result = await api.rpc('createSession', { cwd: '/test' });

      expect(ms.emitWithAck).toHaveBeenCalledWith('rpc', {
        method: 'createSession',
        params: { cwd: '/test' },
      });
      expect(result).toEqual({ id: 'test' });
    });

    it('RPC 错误应该抛出异常', async () => {
      await connectAndWait();
      const ms = getMockSocket();

      ms.emitWithAck.mockResolvedValue({ error: 'not found' });
      await expect(api.rpc('getSession')).rejects.toThrow('not found');
    });

    it('未连接时调用 rpc 应该抛出异常', async () => {
      api.disconnect();
      await expect(api.rpc('test')).rejects.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('应该调用 rpc sendMessage', async () => {
      await connectAndWait();
      const ms = getMockSocket();

      const mockMsg = { kind: 'agent', id: 'r1', text: 'done', createdAt: 1 };
      ms.emitWithAck.mockResolvedValue({ data: mockMsg });

      const result = await api.sendMessage('s1', 'hello');
      expect(ms.emitWithAck).toHaveBeenCalledWith('rpc', {
        method: 'sendMessage',
        params: { sessionId: 's1', text: 'hello' },
      });
      expect(result).toEqual(mockMsg);
    });
  });

  describe('createSession', () => {
    it('应该调用 rpc createSession', async () => {
      await connectAndWait();
      const ms = getMockSocket();

      const mockSession = { id: 's1', cwd: '/', projectName: 'p', messages: [], createdAt: 1 };
      ms.emitWithAck.mockResolvedValue({ data: mockSession });

      const result = await api.createSession('/');
      expect(ms.emitWithAck).toHaveBeenCalledWith('rpc', {
        method: 'createSession',
        params: { cwd: '/' },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('subscribe', () => {
    it('应该接收 session-created 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      const session = { id: 's1', cwd: '/', projectName: 'p', messages: [], createdAt: 1 };
      emitSocketEvent('session-created', session);

      expect(listener).toHaveBeenCalledWith({ type: 'session-created', session });
    });

    it('应该接收 message 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      const msg = { kind: 'user', id: 'm1', text: 'hi', status: 'sent', createdAt: 1 };
      emitSocketEvent('message', { sessionId: 's1', message: msg });

      expect(listener).toHaveBeenCalledWith({
        type: 'message', sessionId: 's1', message: msg,
      });
    });

    it('应该接收 tool-update 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('tool-update', {
        sessionId: 's1', toolId: 't1', status: 'success', result: 'ok',
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'tool-update', sessionId: 's1', toolId: 't1', status: 'success', result: 'ok',
      });
    });

    it('unsubscribe 应该停止接收事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener)();
      emitSocketEvent('session-created', {});
      expect(listener).not.toHaveBeenCalled();
    });

    it('多个 listener 应该都收到事件', async () => {
      await connectAndWait();
      const l1 = jest.fn();
      const l2 = jest.fn();
      api.subscribe(l1);
      api.subscribe(l2);

      emitSocketEvent('session-updated', { id: 's1' });
      expect(l1).toHaveBeenCalled();
      expect(l2).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('应该断开 socket 连接', async () => {
      await connectAndWait();
      api.disconnect();
      expect(getMockSocket().disconnect).toHaveBeenCalled();
    });

    it('重复 disconnect 不应该报错', () => {
      expect(() => api.disconnect()).not.toThrow();
    });
  });

  describe('connected getter', () => {
    it('未连接时返回 false', () => {
      api.disconnect();
      expect(api.connected).toBe(false);
    });

    it('连接后返回 true', async () => {
      await connectAndWait();
      expect(api.connected).toBe(true);
    });
  });
});
