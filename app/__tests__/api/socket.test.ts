/**
 * ApiClient (socket.ts) 单元测试
 * 匹配服务端 Socket.IO 事件协议
 */

// Mock socket.io-client
jest.mock('socket.io-client', () => {
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
    disconnect: jest.fn(() => {
      mockSocketObj.connected = false;
      mockEmitter.emit('disconnect', 'io client disconnect');
    }),
    connect: jest.fn(),
    _trigger: (event: string, ...args: any[]) => mockEmitter.emit(event, ...args),
    _clear: () => mockEmitter.removeAllListeners(),
  };

  (global as any).__mockSocket = mockSocketObj;

  const mockIoFn = jest.fn(() => {
    mockSocketObj.connected = false;
    return mockSocketObj;
  });

  return { io: mockIoFn };
});

import { api } from '../../api/socket';

function getMockSocket() {
  return (global as any).__mockSocket;
}

function emitSocketEvent(event: string, ...args: any[]) {
  getMockSocket()._trigger(event, ...args);
}

async function connectAndWait(url = 'http://192.168.1.5:8080') {
  const promise = api.connect(url);
  getMockSocket().connected = true;
  emitSocketEvent('connect');
  return promise;
}

beforeEach(() => {
  const ms = getMockSocket();
  ms._clear();
  ms.on.mockClear();
  ms.emit.mockClear();
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

    it('应该提取 origin 作为连接地址（去掉路径）', async () => {
      await connectAndWait('http://192.168.1.5:8080/app');
      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith('http://192.168.1.5:8080', expect.objectContaining({
        transports: ['websocket', 'polling'],
      }));
    });

    it('应该配置重连参数', async () => {
      await connectAndWait();
      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 15000,
      }));
    });

    it('应该注册服务端事件处理器', async () => {
      await connectAndWait();
      const ms = getMockSocket();
      expect(ms.on).toHaveBeenCalledWith('client-info', expect.any(Function));
      expect(ms.on).toHaveBeenCalledWith('processes-list', expect.any(Function));
      expect(ms.on).toHaveBeenCalledWith('process-started', expect.any(Function));
      expect(ms.on).toHaveBeenCalledWith('claude-output', expect.any(Function));
      expect(ms.on).toHaveBeenCalledWith('auth-required', expect.any(Function));
    });

    it('连接失败应该 reject', async () => {
      const promise = api.connect('http://bad-host:8080');
      emitSocketEvent('connect_error', new Error('timeout'));
      await expect(promise).rejects.toThrow('timeout');
    });
  });

  describe('ready', () => {
    it('应该发送 ready 事件', async () => {
      await connectAndWait();
      api.ready();
      expect(getMockSocket().emit).toHaveBeenCalledWith('ready');
    });

    it('未连接时不应该发送', () => {
      api.ready();
      // io mock 未调用则 emit 未被调用
    });
  });

  describe('startProcess', () => {
    it('应该发送 start-process 事件', async () => {
      await connectAndWait();
      api.startProcess('/home/user');
      expect(getMockSocket().emit).toHaveBeenCalledWith('start-process', { cwd: '/home/user' });
    });

    it('不带参数也应该发送', async () => {
      await connectAndWait();
      api.startProcess();
      expect(getMockSocket().emit).toHaveBeenCalledWith('start-process', { cwd: undefined });
    });
  });

  describe('sendTerminalInput', () => {
    it('应该发送 terminal-input 事件', async () => {
      await connectAndWait();

      // 先模拟 process-started 设置 currentProcessId
      emitSocketEvent('process-started', {
        id: 'proc-1',
        cwd: '/test',
        projectName: 'test-project',
      });

      api.sendTerminalInput('ls -la\n');
      expect(getMockSocket().emit).toHaveBeenCalledWith('terminal-input', {
        id: 'proc-1',
        data: 'ls -la\n',
      });
    });

    it('没有 processId 时不应发送', async () => {
      await connectAndWait();
      getMockSocket().emit.mockClear();
      api.sendTerminalInput('test\n');
      expect(getMockSocket().emit).not.toHaveBeenCalledWith('terminal-input', expect.anything());
    });
  });

  describe('resize', () => {
    it('应该发送 resize 事件', async () => {
      await connectAndWait();

      emitSocketEvent('process-started', {
        id: 'proc-1', cwd: '/', projectName: 'test',
      });

      api.resize(80, 24);
      expect(getMockSocket().emit).toHaveBeenCalledWith('resize', {
        id: 'proc-1',
        cols: 80,
        rows: 24,
      });
    });
  });

  describe('auth', () => {
    it('认证成功应该返回 success', async () => {
      await connectAndWait();

      getMockSocket().emit.mockImplementation((event: string, password: string, cb: Function) => {
        if (event === 'auth') cb({ success: true, token: 'tok123' });
      });

      const result = await api.auth('mypassword');
      expect(result).toEqual({ success: true, token: 'tok123' });
    });

    it('认证失败应该返回错误', async () => {
      await connectAndWait();

      getMockSocket().emit.mockImplementation((event: string, password: string, cb: Function) => {
        if (event === 'auth') cb({ success: false, error: 'wrong password' });
      });

      const result = await api.auth('wrong');
      expect(result).toEqual({ success: false, error: 'wrong password' });
    });

    it('未连接时认证应返回错误', async () => {
      const result = await api.auth('test');
      expect(result).toEqual({ success: false, error: '未连接' });
    });
  });

  describe('subscribe', () => {
    it('应该接收 client-info 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('client-info', { ip: '192.168.1.100' });
      expect(listener).toHaveBeenCalledWith({
        type: 'client-info',
        info: { ip: '192.168.1.100' },
      });
    });

    it('应该接收 process-started 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('process-started', {
        id: 'p1', cwd: '/home', projectName: 'myapp',
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'process-started',
        session: {
          id: 'p1',
          cwd: '/home',
          projectName: 'myapp',
          messages: [],
          createdAt: expect.any(Number),
        },
      });
    });

    it('应该接收 terminal-output (claude-output) 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('claude-output', { id: 'p1', output: 'Hello World' });

      expect(listener).toHaveBeenCalledWith({
        type: 'terminal-output',
        processId: 'p1',
        output: 'Hello World',
      });
    });

    it('应该接收 processes-list 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      const processes = [
        { id: 'p1', cwd: '/', projectName: 'a', createdAt: 1 },
      ];
      emitSocketEvent('processes-list', processes);

      expect(listener).toHaveBeenCalledWith({
        type: 'processes-list',
        processes,
      });
    });

    it('应该接收 auth-required 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('auth-required', { required: true });
      expect(listener).toHaveBeenCalledWith({ type: 'auth-required' });
    });

    it('auth-required 为 false 时不应该触发', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('auth-required', { required: false });
      expect(listener).not.toHaveBeenCalled();
    });

    it('应该接收 disconnected 事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener);

      emitSocketEvent('disconnect', 'transport close');
      expect(listener).toHaveBeenCalledWith({
        type: 'disconnected',
        reason: 'transport close',
      });
    });

    it('unsubscribe 应该停止接收事件', async () => {
      await connectAndWait();
      const listener = jest.fn();
      api.subscribe(listener)();
      emitSocketEvent('process-started', { id: 'p1', cwd: '/', projectName: 't' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('多个 listener 应该都收到事件', async () => {
      await connectAndWait();
      const l1 = jest.fn();
      const l2 = jest.fn();
      api.subscribe(l1);
      api.subscribe(l2);

      emitSocketEvent('processes-updated', []);
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

    it('断开后 processId 应清空', async () => {
      await connectAndWait();
      emitSocketEvent('process-started', { id: 'p1', cwd: '/', projectName: 't' });
      expect(api.processId).toBe('p1');

      api.disconnect();
      expect(api.processId).toBeNull();
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

  describe('processId getter', () => {
    it('初始为 null', () => {
      expect(api.processId).toBeNull();
    });

    it('process-started 后更新', async () => {
      await connectAndWait();
      emitSocketEvent('process-started', { id: 'abc', cwd: '/', projectName: 't' });
      expect(api.processId).toBe('abc');
    });
  });
});
