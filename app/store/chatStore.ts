/**
 * 聊天状态管理 v2
 * 优化：减少 Map 重建、消息数组增量更新
 */

import { create } from 'zustand';
import { Message, Session, ToolMessage } from '../types/message';

interface ChatState {
  // 状态
  sessions: Record<string, Session>;
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
  // 初始状态 - 使用 Record 替代 Map，减少重建开销
  sessions: {},
  currentSessionId: null,
  connected: false,
  connecting: true,

  // 会话操作
  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  createSession: (session) => set((state) => ({
    sessions: { ...state.sessions, [session.id]: session },
    currentSessionId: session.id,
  })),

  updateSession: (sessionId, updates) => set((state) => {
    const session = state.sessions[sessionId];
    if (!session) return state;
    return {
      sessions: { ...state.sessions, [sessionId]: { ...session, ...updates } },
    };
  }),

  // 消息操作 - 增量更新
  addMessage: (sessionId, message) => set((state) => {
    const session = state.sessions[sessionId];
    if (!session) return state;
    return {
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...session,
          messages: [...session.messages, message],
        },
      },
    };
  }),

  updateMessage: (sessionId, messageId, updates) => set((state) => {
    const session = state.sessions[sessionId];
    if (!session) return state;
    return {
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...session,
          messages: session.messages.map(m =>
            m.id === messageId ? { ...m, ...updates } as Message : m
          ),
        },
      },
    };
  }),

  updateToolStatus: (sessionId, toolId, status, result) => set((state) => {
    const session = state.sessions[sessionId];
    if (!session) return state;
    return {
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...session,
          messages: session.messages.map(m => {
            if (m.kind === 'tool' && m.id === toolId) {
              return { ...m, status, result } as ToolMessage;
            }
            return m;
          }),
        },
      },
    };
  }),

  // 连接状态
  setConnected: (connected) => set({ connected, connecting: false }),
  setConnecting: (connecting) => set({ connecting }),

  // 便捷方法
  getCurrentSession: () => {
    const state = get();
    if (!state.currentSessionId) return undefined;
    return state.sessions[state.currentSessionId];
  },

  getMessages: () => {
    const session = get().getCurrentSession();
    return session?.messages || [];
  },
}));
