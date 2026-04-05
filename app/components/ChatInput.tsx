/**
 * 消息输入组件 v2
 * 精简版：固定工具栏 + 键盘 Return 发送
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

// 精简为最常用的 4 个工具
const QUICK_TOOLS = [
  { icon: '⇥', label: 'Tab', color: '#6366f1' },
  { icon: '⎋', label: 'Esc', color: '#6366f1' },
  { icon: '📋', label: '粘贴', color: '#8b5cf6' },
  { icon: '␣', label: '空格', color: '#6366f1' },
] as const;

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

interface Selection {
  start: number;
  end: number;
}

export function ChatInput({ onSend, disabled, loading }: Props) {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // 发送消息
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setText('');
    Keyboard.dismiss();
  }, [text, disabled, loading, onSend]);

  // 键盘 Return 键发送
  const handleSubmitEditing = useCallback(() => {
    handleSend();
  }, [handleSend]);

  // Tab 键
  const handleTab = useCallback(() => {
    if (disabled || loading) return;
    const before = text.substring(0, selection.start);
    const after = text.substring(selection.end);
    const newText = before + '\t' + after;
    setText(newText);
    const cursor = selection.start + 1;
    setSelection({ start: cursor, end: cursor });
    inputRef.current?.focus();
  }, [text, selection, disabled, loading]);

  // 空格键
  const handleSpace = useCallback(() => {
    if (disabled || loading) return;
    const before = text.substring(0, selection.start);
    const after = text.substring(selection.end);
    const newText = before + ' ' + after;
    setText(newText);
    const cursor = selection.start + 1;
    setSelection({ start: cursor, end: cursor });
    inputRef.current?.focus();
  }, [text, selection, disabled, loading]);

  // Esc 键
  const handleEsc = useCallback(() => {
    if (disabled || loading) return;
    onSend('\x1b');
  }, [disabled, loading, onSend]);

  // 粘贴
  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        const before = text.substring(0, selection.start);
        const after = text.substring(selection.end);
        const newText = before + clipboardText + after;
        setText(newText);
        const cursor = selection.start + clipboardText.length;
        setSelection({ start: cursor, end: cursor });
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('粘贴失败:', err);
    }
  }, [text, selection]);

  // 工具按钮映射
  const toolActions: Record<string, () => void> = {
    'Tab': handleTab,
    'Esc': handleEsc,
    '粘贴': handlePaste,
    '空格': handleSpace,
  };

  const canSend = text.trim().length > 0 && !disabled && !loading;

  return (
    <View style={styles.container}>
      {/* 快捷工具栏 */}
      <View style={styles.toolbar}>
        {QUICK_TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.label}
            style={[styles.toolBtn, { backgroundColor: tool.color + '15' }]}
            onPress={toolActions[tool.label]}
            disabled={disabled || loading}
            activeOpacity={0.6}
          >
            <Text style={styles.toolBtnIcon}>{tool.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 输入行 */}
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSelectionChange={(e) => {
            const { start, end } = e.nativeEvent.selection;
            setSelection({ start, end });
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="输入消息..."
          placeholderTextColor="#555"
          multiline
          maxLength={4000}
          editable={!disabled && !loading}
          selection={selection}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSubmitEditing}
        />
        <TouchableOpacity
          style={[styles.sendButton, canSend ? styles.sendActive : styles.sendDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12121e',
    borderTopWidth: 1,
    borderTopColor: '#1e1e30',
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 6,
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnIcon: {
    fontSize: 16,
    color: '#aab',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    paddingHorizontal: 10,
    gap: 8,
    alignItems: 'flex-end',
  },
  inputRowFocused: {
    // focus 状态无额外变化，保持简洁
  },
  input: {
    flex: 1,
    backgroundColor: '#0a0a14',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendActive: {
    backgroundColor: '#3b82f6',
  },
  sendDisabled: {
    backgroundColor: '#1e1e30',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
});
