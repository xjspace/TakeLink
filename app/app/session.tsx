/**
 * 会话页面 v2
 * 改进：打字指示器、头部导航、空状态、断线反馈
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../api/socket';
import { useChatStore } from '../store/chatStore';
import { ChatList } from '../components/ChatList';
import { ChatInput } from '../components/ChatInput';
import { Session, Message } from '../types/message';

// 空状态提示
const QUICK_TIPS = [
  { icon: '💻', text: '输入命令来控制远程终端' },
  { icon: '🔍', text: '试试 "查看当前目录"' },
  { icon: '📝', text: '可以发送自然语言指令' },
];

export default function SessionScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();

  // Store
  const {
    connected,
    connecting,
    setConnected,
    setConnecting,
    createSession,
    getCurrentSession,
    getMessages,
    addMessage,
    updateToolStatus,
  } = useChatStore();

  const session = getCurrentSession();
  const messages = getMessages();
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打字指示器动画
  const dot1 = useState(new Animated.Value(0))[0];
  const dot2 = useState(new Animated.Value(0))[0];
  const dot3 = useState(new Animated.Value(0))[0];

  // 启动打字动画
  useEffect(() => {
    if (!agentTyping) return;

    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const anim = Animated.parallel([
      animate(dot1, 0),
      animate(dot2, 150),
      animate(dot3, 300),
    ]);
    anim.start();

    return () => { anim.stop(); };
  }, [agentTyping]);

  // 连接服务器
  useEffect(() => {
    if (!url) {
      router.back();
      return;
    }

    let mounted = true;

    const connectAndInit = async () => {
      try {
        setConnecting(true);
        await api.connect(url as string);

        if (!mounted) return;

        setConnected(true);

        // 订阅事件
        const unsubscribe = api.subscribe((event) => {
          if (!mounted) return;

          switch (event.type) {
            case 'session-created':
              createSession(event.session);
              break;
            case 'message':
              addMessage(event.sessionId, event.message);
              // Agent 回复结束
              if (event.message.kind === 'agent') {
                setAgentTyping(false);
              }
              break;
            case 'tool-update':
              updateToolStatus(event.sessionId, event.toolId, event.status, event.result);
              // 工具开始执行 = Agent 正在工作
              if (event.status === 'running') {
                setAgentTyping(true);
              }
              break;
          }
        });

        // 创建会话
        const newSession = await api.createSession();
        createSession(newSession);

        return unsubscribe;
      } catch (err) {
        console.error('连接失败:', err);
        if (mounted) {
          setConnected(false);
          setConnecting(false);
        }
      }
    };

    connectAndInit();

    return () => {
      mounted = false;
      api.disconnect();
    };
  }, [url]);

  // 发送消息
  const handleSend = useCallback(async (text: string) => {
    if (!session || sending) return;

    setSending(true);
    setAgentTyping(true);

    // 清除之前的定时器
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    try {
      // 乐观更新：先添加用户消息
      const tempId = `temp-${Date.now()}`;
      addMessage(session.id, {
        kind: 'user',
        id: tempId,
        text,
        status: 'pending',
        createdAt: Date.now(),
      });

      // 发送到服务端
      await api.sendMessage(session.id, text);
    } catch (err) {
      console.error('发送失败:', err);
      setAgentTyping(false);
    } finally {
      setSending(false);
    }
  }, [session, sending]);

  // === 加载状态 ===
  if (connecting) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
          <Text style={styles.loadingTitle}>正在连接</Text>
          <Text style={styles.loadingUrl}>{url}</Text>
        </View>
      </View>
    );
  }

  // === 断线状态 ===
  if (!connected) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.loadingContent}>
          <View style={styles.disconnectIcon}>
            <Text style={styles.disconnectIconText}>⚡</Text>
          </View>
          <Text style={styles.loadingTitle}>连接已断开</Text>
          <Text style={styles.loadingUrl}>{url}</Text>
          <TouchableOpacity style={styles.reconnectBtn} onPress={() => router.back()}>
            <Text style={styles.reconnectText}>返回重连</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // === 等待会话 ===
  if (!session) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingTitle}>正在创建会话...</Text>
        </View>
      </View>
    );
  }

  // === 主界面 ===
  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {session.projectName || 'TakeLink'}
          </Text>
          <View style={[styles.statusDot, connected ? styles.dotOnline : styles.dotOffline]} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* 内容区 */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {isEmpty ? (
          <EmptyState />
        ) : (
          <ChatList messages={messages} />
        )}

        {/* 打字指示器 */}
        {agentTyping && <TypingIndicator dot1={dot1} dot2={dot2} dot3={dot3} />}

        <ChatInput onSend={handleSend} loading={sending || agentTyping} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ========== 空状态组件 ==========

function EmptyState() {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>🤖</Text>
      <Text style={emptyStyles.title}>开始对话</Text>
      <Text style={emptyStyles.desc}>向远程终端发送指令</Text>
      <View style={emptyStyles.tips}>
        {QUICK_TIPS.map((tip, i) => (
          <View key={i} style={emptyStyles.tip}>
            <Text style={emptyStyles.tipIcon}>{tip.icon}</Text>
            <Text style={emptyStyles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  desc: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 32,
  },
  tips: {
    gap: 12,
    width: '100%',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

// ========== 打字指示器 ==========

function TypingIndicator({ dot1, dot2, dot3 }: {
  dot1: Animated.Value;
  dot2: Animated.Value;
  dot3: Animated.Value;
}) {
  const dotStyle = (anim: Animated.Value) => ({
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });

  return (
    <View style={typingStyles.container}>
      <View style={typingStyles.bubble}>
        <Animated.View style={[typingStyles.dot, dotStyle(dot1)]} />
        <Animated.View style={[typingStyles.dot, dotStyle(dot2)]} />
        <Animated.View style={[typingStyles.dot, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bubble: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
});

// ========== 样式 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },

  // 全屏状态
  fullScreen: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f615',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  loadingUrl: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
  },
  disconnectIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ef444415',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  disconnectIconText: {
    fontSize: 30,
  },
  reconnectBtn: {
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // 头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#12121e',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e30',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
  },
  backIcon: {
    color: '#3b82f6',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    maxWidth: 200,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: '#4ade80',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },

  content: {
    flex: 1,
  },
});
