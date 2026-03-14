/**
 * 消息类型定义
 */

// 消息状态
export type MessageStatus = 'pending' | 'sent' | 'error';

// 用户消息
export interface UserMessage {
  kind: 'user';
  id: string;
  text: string;
  status: MessageStatus;
  createdAt: number;
}

// Agent 文本消息
export interface AgentMessage {
  kind: 'agent';
  id: string;
  text: string;
  createdAt: number;
}

// 工具调用消息
export interface ToolMessage {
  kind: 'tool';
  id: string;
  name: string;
  input?: string;
  result?: string;
  status: 'running' | 'success' | 'error';
  createdAt: number;
}

// 统一消息类型
export type Message = UserMessage | AgentMessage | ToolMessage;

// 会话信息
export interface Session {
  id: string;
  cwd: string;
  projectName: string;
  messages: Message[];
  createdAt: number;
}

// RPC 请求/响应类型
export interface RPCRequest<T = any> {
  method: string;
  params: T;
}

export interface RPCResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

// API 事件类型
export type APIEvent =
  | { type: 'message'; sessionId: string; message: Message }
  | { type: 'session-created'; session: Session }
  | { type: 'session-updated'; session: Session }
  | { type: 'tool-update'; sessionId: string; toolId: string; status: ToolMessage['status']; result?: string };
