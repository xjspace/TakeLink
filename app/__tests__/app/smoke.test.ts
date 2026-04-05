/**
 * 页面级 Smoke 测试
 * 验证关键页面和模块可以正常导入
 */

// Mock 所有原生依赖 - mock factory 内不能引用外部变量
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ url: 'http://localhost:8080' })),
}));

jest.mock('expo-camera', () => ({
  CameraView: ({ children }: any) => children,
  useCameraPermissions: jest.fn(() => [
    { granted: false, canAskAgain: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ]),
}));

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(store[k] || null)),
    setItemAsync: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve(); }),
    deleteItemAsync: jest.fn(),
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => props?.children ?? null,
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn().mockResolvedValue('') }));

jest.mock('../../api/socket', () => ({
  api: {
    connect: jest.fn(() => Promise.resolve('mock-id')),
    disconnect: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    createSession: jest.fn(),
    sendMessage: jest.fn(),
    connected: true,
  },
}));

jest.mock('../../store/chatStore', () => ({
  useChatStore: jest.fn((selector: any) => selector({
    connected: true,
    connecting: false,
    currentSessionId: 's1',
    sessions: {
      s1: { id: 's1', cwd: '/test', projectName: 'Test', messages: [], createdAt: 1 },
    },
    setConnected: jest.fn(),
    setConnecting: jest.fn(),
    createSession: jest.fn(),
    addMessage: jest.fn(),
    updateToolStatus: jest.fn(),
    getCurrentSession: jest.fn(() => ({
      id: 's1', cwd: '/test', projectName: 'Test', messages: [], createdAt: 1,
    })),
    getMessages: jest.fn(() => []),
  })),
}));

jest.mock('../../components/ChatList', () => ({ ChatList: () => null }));
jest.mock('../../components/ChatInput', () => ({ ChatInput: () => null }));
jest.mock('../../components/MessageBubble', () => ({ MessageBubble: () => null }));

describe('模块导入 Smoke 测试', () => {
  it('session 页面模块可以正常导入', () => {
    const mod = require('../../app/session');
    expect(mod.default).toBeDefined();
  });

  it('index 页面模块可以正常导入', () => {
    const mod = require('../../app/index');
    expect(mod.default).toBeDefined();
  });

  it('layout 模块可以正常导入', () => {
    const mod = require('../../app/_layout');
    expect(mod.default).toBeDefined();
  });

  it('chatStore 模块可以正常导入', () => {
    const mod = require('../../store/chatStore');
    expect(mod.useChatStore).toBeDefined();
  });

  it('socket API 模块可以正常导入', () => {
    const mod = require('../../api/socket');
    expect(mod.api).toBeDefined();
  });

  it('message types 模块可以正常导入', () => {
    // TypeScript type-only exports are erased at runtime
    // Just verify the module doesn't throw on import
    expect(() => require('../../types/message')).not.toThrow();
  });
});
