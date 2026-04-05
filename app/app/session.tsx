/**
 * 会话页面 - 终端交互
 * 匹配服务端事件协议：start-process → terminal-input → claude-output
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../api/socket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TerminalLine {
  id: string;
  text: string;
  timestamp: number;
}

export default function SessionScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<TerminalLine[]>([]);
  const [inputText, setInputText] = useState('');
  const [processStarted, setProcessStarted] = useState(false);
  const outputCounter = useRef(0);
  const flatListRef = useRef<FlatList>(null);
  const mounted = useRef(true);

  // 连接并启动终端
  useEffect(() => {
    if (!url) {
      router.back();
      return;
    }

    const connectAndInit = async () => {
      try {
        setConnecting(true);
        setError(null);
        await api.connect(decodeURIComponent(url));
        if (!mounted.current) return;

        setConnected(true);
        setConnecting(false);

        // 订阅服务端事件
        const unsubscribe = api.subscribe((event) => {
          if (!mounted.current) return;

          switch (event.type) {
            case 'terminal-output':
              appendOutput(event.output);
              break;
            case 'process-started':
              setProcessStarted(true);
              break;
            case 'auth-required':
              setError('服务器需要密码认证');
              break;
            case 'disconnected':
              setConnected(false);
              break;
          }
        });

        // 通知服务端客户端已就绪
        api.ready();

        // 启动终端进程
        api.startProcess();

        return unsubscribe;
      } catch (err: any) {
        console.error('[Session] 连接失败:', err);
        if (mounted.current) {
          setConnecting(false);
          setError(err.message || '连接失败');
        }
      }
    };

    connectAndInit();

    return () => {
      mounted.current = false;
      api.disconnect();
    };
  }, [url]);

  const appendOutput = useCallback((text: string) => {
    const line: TerminalLine = {
      id: `line-${++outputCounter.current}`,
      text: stripAnsi(text),
      timestamp: Date.now(),
    };
    setOutput(prev => [...prev, line]);
  }, []);

  // 发送命令
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    api.sendTerminalInput(text + '\r');
    setInputText('');
  }, [inputText]);

  // 基础 ANSI 转义序列清除
  function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  // 渲染单行输出
  const renderLine = ({ item }: { item: TerminalLine }) => (
    <Text style={styles.terminalLine} selectable>
      {item.text}
    </Text>
  );

  // === 加载状态 ===
  if (connecting) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.statusText}>正在连接...</Text>
          <Text style={styles.urlText}>{url ? decodeURIComponent(url) : ''}</Text>
        </View>
      </View>
    );
  }

  // === 错误状态 ===
  if (error) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.statusText}>连接失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>返回重试</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // === 断线状态 ===
  if (!connected) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.statusText}>连接已断开</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>返回重连</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // === 终端界面 ===
  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>TakeLink Terminal</Text>
          <View style={[styles.statusDot, connected && styles.dotOnline]} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* 终端输出 */}
      <FlatList
        ref={flatListRef}
        data={output}
        renderItem={renderLine}
        keyExtractor={item => item.id}
        style={styles.terminal}
        contentContainerStyle={styles.terminalContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* 输入栏 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}
      >
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入命令..."
          placeholderTextColor="#4b5563"
          onSubmitEditing={handleSend}
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.7}>
          <Text style={styles.sendBtnText}>{'>'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    padding: 24,
  },

  // 头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
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
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  dotOnline: {
    backgroundColor: '#4ade80',
  },

  // 状态
  statusText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 6,
  },
  urlText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 36,
    color: '#ef4444',
    backgroundColor: '#ef444420',
    width: 64,
    height: 64,
    borderRadius: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 64,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // 终端
  terminal: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  terminalContent: {
    padding: 12,
    paddingBottom: 20,
  },
  terminalLine: {
    color: '#d4d4d8',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
  },

  // 输入栏
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#12121e',
    borderTopWidth: 1,
    borderTopColor: '#1e1e30',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    fontFamily: 'monospace',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
