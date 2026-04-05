/**
 * 连接页面 - 输入地址或扫码连接
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HISTORY_KEY = 'takelink_history';
const MAX_HISTORY = 5;

interface HistoryItem {
  url: string;
  lastUsed: number;
}

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const params = useLocalSearchParams<{ scannedUrl?: string }>();

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 处理扫描返回的 URL
  useEffect(() => {
    if (params.scannedUrl) {
      const url = decodeURIComponent(params.scannedUrl);
      setInputUrl(cleanUrl(url));
      // 自动连接
      handleConnect(url);
    }
  }, [params.scannedUrl]);

  // 默认填充已在 loadHistory 中处理

  const loadHistory = async () => {
    try {
      const saved = await SecureStore.getItemAsync(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
        // 如果没有扫码URL且输入框为空，用最近地址填入（去掉 http:// 前缀）
        if (!params.scannedUrl && parsed.length > 0) {
          setInputUrl(cleanUrl(parsed[0].url));
        }
      }
    } catch (e) {
      console.error('加载历史失败:', e);
    }
  };

  const saveToHistory = useCallback(async (url: string) => {
    try {
      const newHistory: HistoryItem[] = [
        { url, lastUsed: Date.now() },
        ...history.filter(h => h.url !== url),
      ].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error('保存历史失败:', e);
    }
  }, [history]);

  const handleScan = () => {
    router.push('/scan' as any);
  };

  const handleConnect = (url?: string) => {
    const targetUrl = url || inputUrl.trim();

    if (!targetUrl) {
      Alert.alert('请输入地址', '请输入服务器地址或扫描二维码');
      return;
    }

    // 添加默认端口和路径
    let finalUrl = targetUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }

    // 如果没有端口，添加默认 8080
    try {
      const urlObj = new URL(finalUrl);
      if (!urlObj.port) {
        finalUrl = finalUrl.replace(/(:\d+)?(\/.*)?$/, ':8080$2');
      }
      // 添加 /app 后缀
      if (!finalUrl.endsWith('/app')) {
        finalUrl = finalUrl.replace(/\/$/, '') + '/app';
      }
    } catch {
      Alert.alert('无效地址', '请输入有效的服务器地址');
      return;
    }

    // 保存到历史并连接
    saveToHistory(finalUrl.replace('/app', ''));
    router.push(`/session?url=${encodeURIComponent(finalUrl)}`);
  };

  const handleHistoryPress = (url: string) => {
    setInputUrl(url);
  };

  const deleteHistory = async (url: string) => {
    const newHistory = history.filter(h => h.url !== url);
    setHistory(newHistory);
    await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(newHistory));
  };

  return (
    <LinearGradient
      colors={['#0f0f1a', '#1a1a2e', '#16213e']}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* 顶部搜索栏：输入框 + 连接 + 扫码 */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="输入服务器地址"
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={() => handleConnect()}
            returnKeyType="go"
          />
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleConnect()}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>连接</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleScan}
            activeOpacity={0.7}
          >
            <Text style={styles.scanBtnIcon}>📷</Text>
          </TouchableOpacity>
        </View>

        {/* 历史记录 */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>最近连接</Text>
            {history.slice(0, 5).map((item) => (
              <Pressable
                key={item.url}
                style={[
                  styles.historyItem,
                  inputUrl === item.url && styles.historyItemActive
                ]}
                onLongPress={() => {
                  Alert.alert(
                    '删除记录',
                    '确定删除此连接记录吗？',
                    [
                      { text: '取消', style: 'cancel' },
                      { text: '删除', style: 'destructive', onPress: () => deleteHistory(item.url) },
                    ]
                  );
                }}
                onPress={() => handleHistoryPress(item.url)}
              >
                <Text style={styles.historyIcon}>🖥️</Text>
                <View style={styles.historyContent}>
                  <Text style={styles.historyUrl} numberOfLines={1} ellipsizeMode="middle">
                    {formatUrl(item.url)}
                  </Text>
                  <Text style={styles.historyTime}>{formatTime(item.lastUsed)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* 底部说明 */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.footerText}>
            在电脑上运行 TakeLink CLI{'\n'}
            扫码或输入地址连接
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** 输入框显示用：去掉 http:// 和 /app，只留 ip:port */
function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.host; // host = hostname + port，如 192.168.1.5:8080
  } catch {
    return url;
  }
}

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let host = urlObj.host; // host 含端口，如 [240e:...]:8080
    // IPv6 太长时缩写：只显示首尾段 + 端口
    if (host.includes(':') && host.length > 25) {
      const port = urlObj.port ? `:${urlObj.port}` : '';
      // 取前两段和后两段
      const bare = urlObj.hostname.replace(/^\[|\]$/g, '');
      const parts = bare.split(':');
      const head = parts.slice(0, 2).join(':');
      const tail = parts.slice(-2).join(':');
      host = `[${head}...${tail}]${port}`;
    }
    return host;
  } catch {
    return url.length > 25 ? url.slice(0, 22) + '...' : url;
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // 顶部搜索栏
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },
  actionBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  scanBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnIcon: {
    fontSize: 22,
  },

  // 历史记录
  historySection: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  historyIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyUrl: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    overflow: 'hidden',
  },
  historyTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // 底部
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
});