/**
 * 会话页面 - 消息交互模式
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../api/socket';
import { useChatStore } from '../store/chatStore';
import { ChatList } from '../components/ChatList';
import { ChatInput } from '../components/ChatInput';
import { Session, Message } from '../types/message';

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
              break;
            case 'tool-update':
              updateToolStatus(event.sessionId, event.toolId, event.status, event.result);
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
      const response = await api.sendMessage(session.id, text);

      // 服务端会返回 agent 消息，通过事件接收
    } catch (err) {
      console.error('发送失败:', err);
    } finally {
      setSending(false);
    }
  }, [session, sending]);

  // 连接中
  if (connecting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>正在连接...</Text>
        <Text style={styles.loadingUrl}>{url}</Text>
      </View>
    );
  }

  // 未连接
  if (!connected) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>正在重连...</Text>
        <Text style={styles.loadingUrl}>{url}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 等待会话创建
  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>正在创建会话...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{session.projectName || 'Claude'}</Text>
          <View style={[styles.statusDot, connected ? styles.online : styles.offline]} />
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* 消息列表 */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ChatList messages={messages} />
        <ChatInput onSend={handleSend} loading={sending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 24,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  loadingUrl: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#252540',
  },
  backButton: {
    color: '#3b82f6',
    fontSize: 16,
    width: 50,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  online: {
    backgroundColor: '#4ade80',
  },
  offline: {
    backgroundColor: '#ef4444',
  },
  content: {
    flex: 1,
  },
});
