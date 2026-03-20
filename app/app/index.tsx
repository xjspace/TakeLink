/**
 * 连接页面 - 扫码连接服务器
 * App 专用版：仅支持扫码连接
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';

const HISTORY_KEY = 'takelink_history';
const MAX_HISTORY = 5;

interface HistoryItem {
  url: string;
  lastUsed: number;
}

const { width } = Dimensions.get('window');
const SCAN_SIZE = Math.min(width * 0.7, 280);

export default function ConnectScreen() {
  const [showScanner, setShowScanner] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanAnim] = useState(new Animated.Value(0));

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 扫描动画
  useEffect(() => {
    if (showScanner) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [showScanner]);

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

  const handleScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('权限被拒绝', '需要相机权限才能扫描二维码\n请在设置中开启相机权限');
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
      url = data.replace(/\/app$/, '');
    }

    // 验证 URL 格式并直接连接
    if (url.startsWith('http://') || url.startsWith('https://')) {
      saveToHistory(url);
      router.push(`/session?url=${encodeURIComponent(url)}`);
    } else {
      Alert.alert('无效二维码', '请扫描 TakeLink 显示的二维码');
    }
  }, [saveToHistory]);

  const handleHistoryPress = (url: string) => {
    router.push(`/session?url=${encodeURIComponent(url)}`);
  };

  const deleteHistory = async (url: string) => {
    const newHistory = history.filter(h => h.url !== url);
    setHistory(newHistory);
    await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(newHistory));
  };

  // 扫码界面
  if (showScanner) {
    const scanLineTop = scanAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, SCAN_SIZE - 4],
    });

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
          {/* 顶部栏 */}
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>扫描连接</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* 扫描框 */}
          <View style={[styles.scanFrame, { width: SCAN_SIZE, height: SCAN_SIZE }]}>
            {/* 四角 */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* 扫描线 */}
            <Animated.View style={[styles.scanLine, { top: scanLineTop, width: SCAN_SIZE - 20 }]} />
          </View>

          <Text style={styles.scanHint}>将二维码放入框内自动扫描</Text>

          {/* 底部提示 */}
          <View style={styles.scanFooter}>
            <Text style={styles.scanFooterText}>
              在电脑上运行 TakeLink CLI 显示二维码
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 主界面
  return (
    <LinearGradient
      colors={['#0f0f1a', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      {/* Logo 区域 */}
      <View style={styles.logoSection}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoEmoji}>🚀</Text>
        </View>
        <Text style={styles.title}>TakeLink</Text>
        <Text style={styles.subtitle}>局域网远程终端</Text>
      </View>

      {/* 扫码按钮 */}
      <TouchableOpacity style={styles.scanButton} onPress={handleScan} activeOpacity={0.8}>
        <LinearGradient
          colors={['#3b82f6', '#2563eb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scanButtonGradient}
        >
          <View style={styles.scanButtonIcon}>
            <Text style={styles.scanButtonIconText}>📷</Text>
          </View>
          <Text style={styles.scanButtonText}>扫描二维码连接</Text>
          <Text style={styles.scanButtonHint}>点击开始扫描</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* 历史记录 */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>最近连接</Text>
          {history.map((item) => (
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
              <View style={styles.historyIcon}>
                <Text style={styles.historyIconText}>🖥️</Text>
              </View>
              <View style={styles.historyContent}>
                <Text style={styles.historyUrl} numberOfLines={1}>{formatUrl(item.url)}</Text>
                <Text style={styles.historyTime}>{formatTime(item.lastUsed)}</Text>
              </View>
              <Text style={styles.historyArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 底部说明 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          在电脑上运行 TakeLink CLI{'\n'}
          扫描屏幕上的二维码即可连接
        </Text>
      </View>
    </LinearGradient>
  );
}

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.host;
  } catch {
    return url;
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
    paddingHorizontal: 24,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    paddingTop: 80,
    marginBottom: 40,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
  },

  // 扫码按钮
  scanButton: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scanButtonGradient: {
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  scanButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanButtonIconText: {
    fontSize: 32,
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  scanButtonHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // 历史记录
  historySection: {
    marginBottom: 24,
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
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyIconText: {
    fontSize: 18,
  },
  historyContent: {
    flex: 1,
  },
  historyUrl: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  historyArrow: {
    fontSize: 20,
    color: '#4b5563',
  },

  // 底部
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },

  // 扫码界面
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
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: '#fff',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scanFrame: {
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
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    height: 2,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  scanHint: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 24,
  },
  scanFooter: {
    alignItems: 'center',
  },
  scanFooterText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
});
