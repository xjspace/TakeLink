/**
 * 消息气泡组件
 * 支持：时间戳、长按复制、代码块、简单 Markdown、折叠工具消息
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Clipboard,
  Alert,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Message, UserMessage, AgentMessage, ToolMessage } from '../types/message';

interface Props {
  message: Message;
  showTimestamp?: boolean;
}

// ========== 工具函数 ==========

/** 格式化时间戳 */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** 简易 Markdown 渲染：代码块、行内代码、粗体 */
function renderFormattedText(text: string, baseStyle: any) {
  const parts: React.ReactNode[] = [];
  // 先处理代码块 ```...```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // 代码块之前的普通文本
    if (match.index > lastIndex) {
      parts.push(...renderInlineSegments(text.slice(lastIndex, match.index), key, baseStyle));
    }
    // 代码块
    parts.push(
      <View key={`cb-${key++}`} style={styles.codeBlock}>
        {match[1] ? <Text style={styles.codeLang}>{match[1]}</Text> : null}
        <Text style={styles.codeText}>{match[2].trim()}</Text>
      </View>
    );
    lastIndex = match.index + match[0].length;
  }

  // 剩余文本
  if (lastIndex < text.length) {
    parts.push(...renderInlineSegments(text.slice(lastIndex), key, baseStyle));
  }

  return parts.length > 0 ? parts : <Text style={baseStyle}>{text}</Text>;
}

/** 行内格式化：行内代码 `...`、粗体 **...** */
function renderInlineSegments(text: string, startKey: number, baseStyle: any): React.ReactNode[] {
  const segments: React.ReactNode[] = [];
  const regex = /(`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let k = startKey * 100;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push(<Text key={`t-${k++}`} style={baseStyle}>{text.slice(lastIdx, m.index)}</Text>);
    }
    if (m[2]) {
      // 行内代码
      segments.push(<Text key={`ic-${k++}`} style={styles.inlineCode}>{m[2]}</Text>);
    } else if (m[3]) {
      // 粗体
      segments.push(<Text key={`b-${k++}`} style={[baseStyle, { fontWeight: '700' }]}>{m[3]}</Text>);
    }
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < text.length) {
    segments.push(<Text key={`t-${k++}`} style={baseStyle}>{text.slice(lastIdx)}</Text>);
  }

  return segments;
}

// ========== 主组件 ==========

export function MessageBubble({ message, showTimestamp = true }: Props) {
  switch (message.kind) {
    case 'user':
      return <UserBubble message={message} showTimestamp={showTimestamp} />;
    case 'agent':
      return <AgentBubble message={message} showTimestamp={showTimestamp} />;
    case 'tool':
      return <ToolBubble message={message} />;
    default:
      return null;
  }
}

// ========== 长按复制 HOC ==========

function CopyableBubble({ children, content, style }: {
  children: React.ReactNode;
  content: string;
  style?: any;
}) {
  const handleLongPress = useCallback(() => {
    Alert.alert('复制内容', '是否复制这条消息？', [
      { text: '取消', style: 'cancel' },
      {
        text: '复制',
        onPress: () => {
          Clipboard.setString(content);
        },
      },
    ]);
  }, [content]);

  return (
    <Pressable onLongPress={handleLongPress} delayLongPress={400} style={style}>
      {children}
    </Pressable>
  );
}

// ========== 用户消息 ==========

function UserBubble({ message, showTimestamp }: { message: UserMessage; showTimestamp: boolean }) {
  return (
    <CopyableBubble content={message.text} style={[styles.bubbleRow, styles.userRow]}>
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.userText}>{message.text}</Text>
        {message.status === 'pending' && (
          <View style={styles.statusRow}>
            <View style={styles.pendingDot} />
            <Text style={styles.statusText}>发送中</Text>
          </View>
        )}
        {message.status === 'error' && (
          <Text style={styles.errorText}>发送失败 - 点击重试</Text>
        )}
      </View>
      {showTimestamp && (
        <Text style={styles.timestampUser}>{formatTime(message.createdAt)}</Text>
      )}
    </CopyableBubble>
  );
}

// ========== Agent 消息 ==========

function AgentBubble({ message, showTimestamp }: { message: AgentMessage; showTimestamp: boolean }) {
  const hasCodeBlock = message.text.includes('```');

  return (
    <CopyableBubble content={message.text} style={[styles.bubbleRow, styles.agentRow]}>
      <View style={[styles.bubble, styles.agentBubble, hasCodeBlock && styles.agentCodeBubble]}>
        {renderFormattedText(message.text, styles.agentText)}
      </View>
      {showTimestamp && (
        <Text style={styles.timestampAgent}>{formatTime(message.createdAt)}</Text>
      )}
    </CopyableBubble>
  );
}

// ========== 工具消息 ==========

function ToolBubble({ message }: { message: ToolMessage }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    if (Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(prev => !prev);
  }, []);

  const hasDetails = message.input || message.result;

  return (
    <View style={[styles.bubbleRow, styles.toolRow]}>
      <Pressable
        style={[styles.bubble, styles.toolBubble]}
        onPress={hasDetails ? toggleExpand : undefined}
        delayLongPress={400}
        onLongPress={() => {
          const text = [message.input, message.result].filter(Boolean).join('\n');
          if (text) Clipboard.setString(text);
        }}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolNameRow}>
            <View style={[
              styles.toolDot,
              message.status === 'running' && styles.toolDotRunning,
              message.status === 'success' && styles.toolDotSuccess,
              message.status === 'error' && styles.toolDotError,
            ]} />
            <Text style={styles.toolName}>{message.name}</Text>
          </View>
          <View style={styles.toolMeta}>
            {hasDetails && (
              <Text style={styles.expandHint}>{expanded ? '收起' : '展开'}</Text>
            )}
            {message.status === 'running' ? (
              <View style={styles.runningBadge}>
                <Text style={styles.runningText}>运行中</Text>
              </View>
            ) : message.status === 'success' ? (
              <Text style={styles.successIcon}>✓</Text>
            ) : message.status === 'error' ? (
              <Text style={styles.errorIcon}>✗</Text>
            ) : null}
          </View>
        </View>

        {expanded && message.input && (
          <Text style={styles.toolContent} numberOfLines={8}>{message.input}</Text>
        )}
        {expanded && message.result && (
          <View style={styles.toolResultWrap}>
            <Text style={styles.toolResult} numberOfLines={10}>{message.result}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  bubbleRow: {
    maxWidth: '88%',
    marginHorizontal: 16,
    marginVertical: 3,
  },
  userRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  agentRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  toolRow: {
    alignSelf: 'flex-start',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: '#1e1e2e',
    borderBottomLeftRadius: 4,
  },
  agentCodeBubble: {
    borderRadius: 12,
  },
  toolBubble: {
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#252540',
    borderRadius: 10,
    maxWidth: '100%',
  },

  // 文本样式
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

  // 代码块
  codeBlock: {
    backgroundColor: '#0a0a14',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  codeLang: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  codeText: {
    color: '#a5f3fc',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  inlineCode: {
    color: '#a5f3fc',
    backgroundColor: '#0a0a14',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontFamily: 'monospace',
  },

  // 状态
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  statusText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 4,
  },

  // 时间戳
  timestampUser: {
    color: '#4b5563',
    fontSize: 10,
    marginTop: 3,
    marginRight: 4,
  },
  timestampAgent: {
    color: '#4b5563',
    fontSize: 10,
    marginTop: 3,
    marginLeft: 4,
  },

  // 工具消息
  toolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  toolDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4b5563',
  },
  toolDotRunning: {
    backgroundColor: '#3b82f6',
  },
  toolDotSuccess: {
    backgroundColor: '#22c55e',
  },
  toolDotError: {
    backgroundColor: '#ef4444',
  },
  toolName: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  toolMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandHint: {
    color: '#4b5563',
    fontSize: 11,
  },
  runningBadge: {
    backgroundColor: '#3b82f620',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runningText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '500',
  },
  successIcon: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
  },
  errorIcon: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  toolContent: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  toolResultWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#252540',
  },
  toolResult: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
