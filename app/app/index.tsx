/**
 * 连接页面 - 扫码或手动输入服务器地址
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_PORT = '8080';
const HISTORY_KEY = 'takelink_history';
const MAX_HISTORY = 5;

interface HistoryItem {
  url: string;
  lastUsed: number;
}

export default function ConnectScreen() {
  const [serverIp, setServerIp] = useState('192.168.1.');
  const [port, setPort] = useState(DEFAULT_PORT);
  const [showScanner, setShowScanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [permission, requestPermission] = useCameraPermissions();

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await SecureStore.getItemAsync(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载历史失败:', e);
    }
  };

  const saveToHistory = async (url: string) => {
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
  };

  const handleConnect = async (url?: string) => {
    const connectUrl = url || `http://${serverIp}:${port}`;
    if (!connectUrl || (!url && !serverIp)) {
      Alert.alert('提示', '请输入服务器地址');
      return;
    }

    // 保存到历史
    await saveToHistory(connectUrl);

    // 导航到会话页面
    router.push(`/session?url=${encodeURIComponent(connectUrl)}`);
  };

  const handleScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('权限 denied', '需要相机权限才能扫描二维码');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    setShowScanner(false);

    // 解析二维码数据
    // 支持格式: http://192.168.1.100:8080/app 或纯 URL
    let url = data;
    if (data.includes('/app')) {
      // 移除 /app 后缀，保留基础 URL
      url = data.replace(/\/app$/, '');
    }

    // 验证 URL 格式
    if (url.startsWith('http://') || url.startsWith('https://')) {
      handleConnect(url);
    } else {
      Alert.alert('无效二维码', '请扫描 TakeLink 显示的二维码');
    }
  }, []);

  const handleHistoryPress = (url: string) => {
    // 解析 URL 填充输入框
    try {
      const urlObj = new URL(url);
      setServerIp(urlObj.hostname);
      setPort(urlObj.port || DEFAULT_PORT);
    } catch {
      // 直接使用
    }
    handleConnect(url);
  };

  const deleteHistory = async (url: string) => {
    const newHistory = history.filter(h => h.url !== url);
    setHistory(newHistory);
    await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(newHistory));
  };

  // 扫码界面
  if (showScanner) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.scanner}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>扫描二维码</Text>
            <View style={{ width: 50 }} />
          </View>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanHint}>将二维码放入框内自动扫描</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo */}
          <Text style={styles.title}>🚀 TakeLink</Text>
          <Text style={styles.subtitle}>局域网远程终端</Text>

          {/* IP 输入 */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>服务器地址</Text>
            <View style={styles.ipRow}>
              <Text style={styles.protocol}>http://</Text>
              <TextInput
                style={styles.ipInput}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="192.168.1.100"
                placeholderTextColor="#444"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numeric"
              />
              <Text style={styles.colon}>:</Text>
              <TextInput
                style={styles.portInput}
                value={port}
                onChangeText={setPort}
                placeholder="8080"
                placeholderTextColor="#444"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          {/* 连接按钮 */}
          <TouchableOpacity style={styles.button} onPress={() => handleConnect()}>
            <Text style={styles.buttonText}>连接</Text>
          </TouchableOpacity>

          {/* 扫码按钮 */}
          <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
            <Text style={styles.scanButtonText}>📷 扫描二维码</Text>
          </TouchableOpacity>

          {/* 历史记录 */}
          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>最近连接</Text>
              {history.map((item, index) => (
                <Pressable
                  key={item.url}
                  style={styles.historyItem}
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
                  <View style={styles.historyContent}>
                    <Text style={styles.historyUrl}>{item.url}</Text>
                    <Text style={styles.historyTime}>
                      {formatTime(item.lastUsed)}
                    </Text>
                  </View>
                  <Text style={styles.historyArrow}>›</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* 使用说明 */}
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>使用步骤</Text>
            <Text style={styles.hintText}>
              1. 电脑上运行 TakeLink CLI{'\n'}
              2. 扫描屏幕上的二维码{'\n'}
              3. 或手动输入显示的 IP 地址{'\n'}
              4. 开始远程控制终端
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },

  // IP 输入
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
  },
  protocol: {
    color: '#666',
    fontSize: 14,
  },
  ipInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  colon: {
    color: '#666',
    fontSize: 16,
  },
  portInput: {
    width: 70,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },

  // 按钮
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scanButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 24,
  },
  scanButtonText: {
    fontSize: 16,
    color: '#3b82f6',
  },

  // 历史记录
  historySection: {
    marginBottom: 24,
  },
  historyTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  historyContent: {
    flex: 1,
  },
  historyUrl: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
  },
  historyArrow: {
    fontSize: 20,
    color: '#666',
  },

  // 提示
  hint: {
    padding: 16,
    backgroundColor: '#16213e',
    borderRadius: 12,
  },
  hintTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },

  // 扫码
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#fff',
    padding: 10,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scanFrame: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#3b82f6',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanHint: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
  },
});
