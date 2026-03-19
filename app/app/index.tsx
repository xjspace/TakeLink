/**
 * 连接页面 - 输入电脑 IP 或扫描二维码
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';

export default function ConnectScreen() {
  const [serverUrl, setServerUrl] = useState('http://192.168.1.');

  const handleConnect = () => {
    if (serverUrl.trim()) {
      // 导航到会话页面，传递服务器地址
      router.push(`/session?url=${encodeURIComponent(serverUrl.trim())}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>🚀 TakeLink</Text>
        <Text style={styles.subtitle}>局域网远程控制 Claude Code</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>电脑地址</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.100:8080"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleConnect}>
          <Text style={styles.buttonText}>连接</Text>
        </TouchableOpacity>

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            1. 在电脑上运行 TakeLink cli{'\n'}
            2. 扫描或输入显示的地址{'\n'}
            3. 开始远程控制
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 48,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  hint: {
    marginTop: 48,
    padding: 16,
    backgroundColor: '#16213e',
    borderRadius: 12,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
  },
});
