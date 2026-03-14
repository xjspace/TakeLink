/**
 * 消息气泡组件
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message, UserMessage, AgentMessage, ToolMessage } from '../types/message';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  switch (message.kind) {
    case 'user':
      return <UserBubble message={message} />;
    case 'agent':
      return <AgentBubble message={message} />;
    case 'tool':
      return <ToolBubble message={message} />;
    default:
      return null;
  }
}

// 用户消息气泡
function UserBubble({ message }: { message: UserMessage }) {
  return (
    <View style={[styles.bubble, styles.userBubble]}>
      <Text style={styles.userText}>{message.text}</Text>
      {message.status === 'pending' && (
        <Text style={styles.statusText}>发送中...</Text>
      )}
      {message.status === 'error' && (
        <Text style={styles.errorText}>发送失败</Text>
      )}
    </View>
  );
}

// Agent 消息气泡
function AgentBubble({ message }: { message: AgentMessage }) {
  return (
    <View style={[styles.bubble, styles.agentBubble]}>
      <Text style={styles.agentText}>{message.text}</Text>
    </View>
  );
}

// 工具消息气泡
function ToolBubble({ message }: { message: ToolMessage }) {
  return (
    <View style={[styles.bubble, styles.toolBubble]}>
      <View style={styles.toolHeader}>
        <Text style={styles.toolName}>🔧 {message.name}</Text>
        <Text style={[
          styles.toolStatus,
          message.status === 'running' && styles.statusRunning,
          message.status === 'success' && styles.statusSuccess,
          message.status === 'error' && styles.statusError,
        ]}>
          {message.status === 'running' ? '执行中...' : message.status}
        </Text>
      </View>
      {message.input && (
        <Text style={styles.toolContent} numberOfLines={3}>{message.input}</Text>
      )}
      {message.result && (
        <Text style={styles.toolResult} numberOfLines={5}>{message.result}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e1e2e',
    borderBottomLeftRadius: 4,
  },
  toolBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#252540',
    borderRadius: 8,
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  agentText: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 22,
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 4,
  },
  toolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolName: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  toolStatus: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusRunning: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
  statusSuccess: {
    backgroundColor: '#22c55e',
    color: '#fff',
  },
  statusError: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  toolContent: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  toolResult: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#252540',
    fontFamily: 'monospace',
  },
});
