/**
 * chatStore 单元测试
 * 覆盖：会话管理、消息 CRUD、工具状态更新、连接状态、便捷方法
 */

import { useChatStore } from '../../store/chatStore';
import { Message, Session, UserMessage, AgentMessage, ToolMessage } from '../../types/message';

// 辅助函数：创建测试用 Session
function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: 'session-1',
    cwd: '/test',
    projectName: 'test-project',
    messages: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockUserMessage(overrides?: Partial<UserMessage>): UserMessage {
  return {
    kind: 'user',
    id: 'msg-1',
    text: 'hello',
    status: 'sent',
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockAgentMessage(overrides?: Partial<AgentMessage>): AgentMessage {
  return {
    kind: 'agent',
    id: 'msg-2',
    text: 'hi there',
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockToolMessage(overrides?: Partial<ToolMessage>): ToolMessage {
  return {
    kind: 'tool',
    id: 'tool-1',
    name: 'ReadFile',
    status: 'running',
    createdAt: Date.now(),
    ...overrides,
  };
}

// 每个测试前重置 store
beforeEach(() => {
  useChatStore.setState({
    sessions: {},
    currentSessionId: null,
    connected: false,
    connecting: true,
  });
});

describe('chatStore', () => {
  // ========== 初始状态 ==========

  describe('初始状态', () => {
    it('应该有正确的默认值', () => {
      const state = useChatStore.getState();
      expect(state.sessions).toEqual({});
      expect(state.currentSessionId).toBeNull();
      expect(state.connected).toBe(false);
      expect(state.connecting).toBe(true);
    });
  });

  // ========== 会话管理 ==========

  describe('会话管理', () => {
    it('createSession 应该创建会话并设为当前会话', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);

      const state = useChatStore.getState();
      expect(state.sessions['session-1']).toEqual(session);
      expect(state.currentSessionId).toBe('session-1');
    });

    it('createSession 应该支持多个会话', () => {
      const s1 = createMockSession({ id: 's1', projectName: 'p1' });
      const s2 = createMockSession({ id: 's2', projectName: 'p2' });

      useChatStore.getState().createSession(s1);
      useChatStore.getState().createSession(s2);

      const state = useChatStore.getState();
      expect(Object.keys(state.sessions)).toHaveLength(2);
      expect(state.currentSessionId).toBe('s2');
    });

    it('setCurrentSession 应该切换当前会话', () => {
      const s1 = createMockSession({ id: 's1' });
      const s2 = createMockSession({ id: 's2' });
      useChatStore.getState().createSession(s1);
      useChatStore.getState().createSession(s2);

      useChatStore.getState().setCurrentSession('s1');
      expect(useChatStore.getState().currentSessionId).toBe('s1');
    });

    it('setCurrentSession(null) 应该清除当前会话', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);
      useChatStore.getState().setCurrentSession(null);
      expect(useChatStore.getState().currentSessionId).toBeNull();
    });

    it('updateSession 应该更新会话字段', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);
      useChatStore.getState().updateSession('session-1', { projectName: 'updated' });

      expect(useChatStore.getState().sessions['session-1'].projectName).toBe('updated');
    });

    it('updateSession 不存在的会话应保持状态不变', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);

      const prev = useChatStore.getState();
      useChatStore.getState().updateSession('non-exist', { projectName: 'x' });
      expect(useChatStore.getState()).toBe(prev); // 引用不变
    });
  });

  // ========== 消息操作 ==========

  describe('消息操作', () => {
    it('addMessage 应该向指定会话添加消息', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);

      const msg = createMockUserMessage();
      useChatStore.getState().addMessage('session-1', msg);

      expect(useChatStore.getState().sessions['session-1'].messages).toHaveLength(1);
      expect(useChatStore.getState().sessions['session-1'].messages[0]).toEqual(msg);
    });

    it('addMessage 应该增量追加，不影响其他会话', () => {
      const s1 = createMockSession({ id: 's1' });
      const s2 = createMockSession({ id: 's2' });
      useChatStore.getState().createSession(s1);
      useChatStore.getState().createSession(s2);

      useChatStore.getState().addMessage('s1', createMockUserMessage());
      useChatStore.getState().addMessage('s2', createMockAgentMessage());

      expect(useChatStore.getState().sessions['s1'].messages).toHaveLength(1);
      expect(useChatStore.getState().sessions['s2'].messages).toHaveLength(1);
    });

    it('addMessage 不存在的会话应保持状态不变', () => {
      const state = useChatStore.getState();
      useChatStore.getState().addMessage('non-exist', createMockUserMessage());
      expect(useChatStore.getState()).toBe(state);
    });

    it('updateMessage 应该更新指定消息', () => {
      const session = createMockSession();
      const msg = createMockUserMessage({ status: 'pending' });
      useChatStore.getState().createSession(session);
      useChatStore.getState().addMessage('session-1', msg);

      useChatStore.getState().updateMessage('session-1', 'msg-1', { status: 'sent' });

      const updated = useChatStore.getState().sessions['session-1'].messages[0] as UserMessage;
      expect(updated.status).toBe('sent');
    });

    it('updateMessage 不存在的消息应保持不变', () => {
      const session = createMockSession();
      const msg = createMockUserMessage();
      useChatStore.getState().createSession(session);
      useChatStore.getState().addMessage('session-1', msg);

      useChatStore.getState().updateMessage('session-1', 'non-exist', { status: 'error' });
      expect(useChatStore.getState().sessions['session-1'].messages).toHaveLength(1);
    });
  });

  // ========== 工具状态 ==========

  describe('工具状态更新', () => {
    it('updateToolStatus 应该更新工具消息状态', () => {
      const session = createMockSession();
      const tool = createMockToolMessage({ status: 'running' });
      useChatStore.getState().createSession(session);
      useChatStore.getState().addMessage('session-1', tool);

      useChatStore.getState().updateToolStatus('session-1', 'tool-1', 'success', 'file content');

      const updated = useChatStore.getState().sessions['session-1'].messages[0] as ToolMessage;
      expect(updated.status).toBe('success');
      expect(updated.result).toBe('file content');
    });

    it('updateToolStatus 应该只影响工具类型消息', () => {
      const session = createMockSession();
      const userMsg = createMockUserMessage({ id: 'tool-1' }); // 同 id 但 kind 不是 tool
      useChatStore.getState().createSession(session);
      useChatStore.getState().addMessage('session-1', userMsg);

      useChatStore.getState().updateToolStatus('session-1', 'tool-1', 'success');

      const msg = useChatStore.getState().sessions['session-1'].messages[0] as UserMessage;
      expect(msg.kind).toBe('user'); // 不应该被改
      expect((msg as any).status).toBe('sent'); // UserMessage 的 status 不变
    });

    it('updateToolStatus 设置 error 状态', () => {
      const session = createMockSession();
      const tool = createMockToolMessage();
      useChatStore.getState().createSession(session);
      useChatStore.getState().addMessage('session-1', tool);

      useChatStore.getState().updateToolStatus('session-1', 'tool-1', 'error', 'permission denied');

      const updated = useChatStore.getState().sessions['session-1'].messages[0] as ToolMessage;
      expect(updated.status).toBe('error');
      expect(updated.result).toBe('permission denied');
    });
  });

  // ========== 连接状态 ==========

  describe('连接状态', () => {
    it('setConnected(true) 应该同时取消 connecting', () => {
      useChatStore.getState().setConnected(true);
      expect(useChatStore.getState().connected).toBe(true);
      expect(useChatStore.getState().connecting).toBe(false);
    });

    it('setConnected(false) 应该设置 disconnected', () => {
      useChatStore.getState().setConnected(true);
      useChatStore.getState().setConnected(false);
      expect(useChatStore.getState().connected).toBe(false);
    });

    it('setConnecting 应该更新 connecting 状态', () => {
      useChatStore.getState().setConnecting(false);
      expect(useChatStore.getState().connecting).toBe(false);
      useChatStore.getState().setConnecting(true);
      expect(useChatStore.getState().connecting).toBe(true);
    });
  });

  // ========== 便捷方法 ==========

  describe('便捷方法', () => {
    it('getCurrentSession 返回当前会话', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);
      expect(useChatStore.getState().getCurrentSession()).toEqual(session);
    });

    it('getCurrentSession 无当前会话返回 undefined', () => {
      expect(useChatStore.getState().getCurrentSession()).toBeUndefined();
    });

    it('getMessages 返回当前会话的消息列表', () => {
      const session = createMockSession();
      useChatStore.getState().createSession(session);
      useChatStore.getState().addMessage('session-1', createMockUserMessage());
      useChatStore.getState().addMessage('session-1', createMockAgentMessage());

      expect(useChatStore.getState().getMessages()).toHaveLength(2);
    });

    it('getMessages 无会话返回空数组', () => {
      expect(useChatStore.getState().getMessages()).toEqual([]);
    });
  });
});
