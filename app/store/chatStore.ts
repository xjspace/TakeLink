/**
 * 聊天状态管理
 */

import { create } from 'zustand';
import { Message, Session, UserMessage, AgentMessage, ToolMessage } from '../types/message';

interface ChatState {
  // 状态
  sessions: Map<string, Session>;
  currentSessionId: string | null;
  connected: boolean;
  connecting: boolean;

  // 会话操作
  setCurrentSession: (sessionId: string | null) => void;
  createSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;

  // 消息操作
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  updateToolStatus: (sessionId: string, toolId: string, status: ToolMessage['status'], result?: string) => void;

  // 连接状态
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;

  // 便捷方法
  getCurrentSession: () => Session | undefined;
  getMessages: () => Message[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  // 初始状态
  sessions: new Map(),
  currentSessionId: null,
  connected: false,
  connecting: true,

  // 会话操作
  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  createSession: (session) => set((state) => {
    const sessions = new Map(state.sessions);
    sessions.set(session.id, session);
    return { sessions, currentSessionId: session.id };
  }),

  updateSession: (sessionId, updates) => set((state) => {
    const sessions = new Map(state.sessions);
    const session = sessions.get(sessionId);
    if (session) {
      sessions.set(sessionId, { ...session, ...updates });
    }
    return { sessions };
  }),

  // 消息操作
  addMessage: (sessionId, message) => set((state) => {
    const sessions = new Map(state.sessions);
    const session = sessions.get(sessionId);
    if (session) {
      sessions.set(sessionId, {
        ...session,
        messages: [...session.messages, message]
      });
    }
    return { sessions };
  }),

  updateMessage: (sessionId, messageId, updates) => set((state) => {
    const sessions = new Map(state.sessions);
    const session = sessions.get(sessionId);
    if (session) {
      const messages = session.messages.map(m =>
        m.id === messageId ? { ...m, ...updates } as Message : m
      );
      sessions.set(sessionId, { ...session, messages });
    }
    return { sessions };
  }),

  updateToolStatus: (sessionId, toolId, status, result) => set((state) => {
    const sessions = new Map(state.sessions);
    const session = sessions.get(sessionId);
    if (session) {
      const messages = session.messages.map(m => {
        if (m.kind === 'tool' && m.id === toolId) {
          return { ...m, status, result } as ToolMessage;
        }
        return m;
      });
      sessions.set(sessionId, { ...session, messages });
    }
    return { sessions };
  }),

  // 连接状态
  setConnected: (connected) => set({ connected, connecting: false }),
  setConnecting: (connecting) => set({ connecting }),

  // 便捷方法
  getCurrentSession: () => {
    const state = get();
    if (!state.currentSessionId) return undefined;
    return state.sessions.get(state.currentSessionId);
  },

  getMessages: () => {
    const session = get().getCurrentSession();
    return session?.messages || [];
  }
}));
