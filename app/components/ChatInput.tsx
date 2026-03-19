/**
 * 消息输入组件
 * 侧滑工具栏版本 - 从右侧边缘左滑显示纵向菜单
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 140; // 侧边栏宽度
const EDGE_THRESHOLD = 30; // 边缘触发区域

// 工具按钮配置（静态，避免每次渲染重新创建）
const TOOL_BUTTONS_CONFIG = [
  { icon: '↵', label: '发送', color: '#3b82f6' },
  { icon: '+', label: '新建', color: '#22c55e' },
  { icon: '⇥', label: 'Tab', color: '#6366f1' },
  { icon: '␣', label: '空格', color: '#6366f1' },
  { icon: '⎋', label: 'Esc', color: '#6366f1' },
  { icon: '📋', label: '粘贴', color: '#8b5cf6' },
  { icon: '📄', label: '复制', color: '#8b5cf6' },
  { icon: '📝', label: '全选', color: '#8b5cf6' },
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
  const inputRef = useRef<TextInput>(null);

  // 侧边栏动画状态
  const sidebarX = useSharedValue(SIDEBAR_WIDTH);
  const isOpen = useSharedValue(false);

  // 关闭侧边栏（JS 线程版本，用于按钮点击）
  const closeSidebarJS = useCallback(() => {
    sidebarX.value = withSpring(SIDEBAR_WIDTH, { damping: 20, stiffness: 200 });
    isOpen.value = false;
  }, [sidebarX, isOpen]);

  // 边缘滑动手势
  const edgePanGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        // 左滑 - 打开
        sidebarX.value = Math.max(0, SIDEBAR_WIDTH + e.translationX);
      } else if (isOpen.value) {
        // 右滑 - 关闭
        sidebarX.value = Math.min(SIDEBAR_WIDTH, e.translationX);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -30) {
        // 左滑超过阈值，打开
        sidebarX.value = withSpring(0, { damping: 20, stiffness: 200 });
        isOpen.value = true;
      } else if (e.translationX > 30) {
        // 右滑超过阈值，关闭
        sidebarX.value = withSpring(SIDEBAR_WIDTH, { damping: 20, stiffness: 200 });
        isOpen.value = false;
      } else {
        // 回弹
        if (isOpen.value) {
          sidebarX.value = withSpring(0);
        } else {
          sidebarX.value = withSpring(SIDEBAR_WIDTH);
        }
      }
    });

  // 侧边栏动画样式
  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarX.value }],
  }));

  // 遮罩层动画
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: (1 - sidebarX.value / SIDEBAR_WIDTH) * 0.5,
    pointerEvents: isOpen.value ? 'auto' : 'none',
  }));

  // 粘贴剪贴板内容
  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        const before = text.substring(0, selection.start);
        const after = text.substring(selection.end);
        const newText = before + clipboardText + after;
        setText(newText);
        const newCursor = selection.start + clipboardText.length;
        setSelection({ start: newCursor, end: newCursor });
      }
    } catch (err) {
      console.error('粘贴失败:', err);
    }
    closeSidebarJS();
  }, [text, selection, closeSidebarJS]);

  // 复制选中内容
  const handleCopy = useCallback(async () => {
    if (selection.start !== selection.end) {
      const selectedText = text.substring(selection.start, selection.end);
      await Clipboard.setStringAsync(selectedText);
    }
    closeSidebarJS();
  }, [text, selection, closeSidebarJS]);

  // 全选
  const handleSelectAll = useCallback(() => {
    setSelection({ start: 0, end: text.length });
    inputRef.current?.focus();
    closeSidebarJS();
  }, [text.length, closeSidebarJS]);

  // 发送消息
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setText('');
    Keyboard.dismiss();
  }, [text, disabled, loading, onSend]);

  // Tab 键
  const handleTab = useCallback(() => {
    if (disabled || loading) return;
    const before = text.substring(0, selection.start);
    const after = text.substring(selection.end);
    const newText = before + '\t' + after;
    setText(newText);
    const newCursor = selection.start + 1;
    setSelection({ start: newCursor, end: newCursor });
    closeSidebarJS();
  }, [text, selection, disabled, loading, closeSidebarJS]);

  // 空格键
  const handleSpace = useCallback(() => {
    if (disabled || loading) return;
    const before = text.substring(0, selection.start);
    const after = text.substring(selection.end);
    const newText = before + ' ' + after;
    setText(newText);
    const newCursor = selection.start + 1;
    setSelection({ start: newCursor, end: newCursor });
    closeSidebarJS();
  }, [text, selection, disabled, loading, closeSidebarJS]);

  // Esc 键 - 发送转义序列
  const handleEsc = useCallback(() => {
    if (disabled || loading) return;
    // 发送 ESC 字符到终端
    onSend('\x1b');
    closeSidebarJS();
  }, [disabled, loading, onSend, closeSidebarJS]);

  // 工具按钮配置（使用 useMemo 优化）
  const toolButtons = useMemo(() => {
    const actions: Record<string, () => void> = {
      '发送': handleSend,
      '新建': () => {},
      'Tab': handleTab,
      '空格': handleSpace,
      'Esc': handleEsc,
      '粘贴': handlePaste,
      '复制': handleCopy,
      '全选': handleSelectAll,
    };

    const disabledStates: Record<string, boolean> = {
      '复制': selection.start === selection.end,
      '全选': text.length === 0,
    };

    return TOOL_BUTTONS_CONFIG.map(btn => ({
      ...btn,
      action: actions[btn.label] || (() => {}),
      disabled: disabledStates[btn.label] || false,
    }));
  }, [handleSend, handleTab, handleSpace, handleEsc, handlePaste, handleCopy, handleSelectAll, selection.start, selection.end, text.length]);

  return (
    <View style={styles.container}>
      {/* 遮罩层 */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={styles.overlayPressable} onPress={closeSidebarJS} />
      </Animated.View>

      {/* 输入区域 */}
      <View style={styles.inputRow}>
        {/* 触发区域 - 右边缘 */}
        <GestureDetector gesture={edgePanGesture}>
          <View style={styles.edgeTrigger}>
            <View style={styles.edgeIndicator}>
              <View style={styles.edgeBar} />
            </View>
          </View>
        </GestureDetector>

        {/* 输入框 */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSelectionChange={(e) => {
            const { start, end } = e.nativeEvent.selection;
            setSelection({ start, end });
          }}
          placeholder="输入消息..."
          placeholderTextColor="#666"
          multiline
          maxLength={4000}
          editable={!disabled && !loading}
          selection={selection}
        />

        {/* 快捷发送按钮 */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || disabled || loading) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || disabled || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>↵</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 侧滑工具栏 */}
      <Animated.View style={[styles.sidebar, sidebarStyle]}>
        {toolButtons.map((btn, index) => (
          <TouchableOpacity
            key={btn.label}
            style={[
              styles.toolButton,
              { backgroundColor: btn.disabled ? '#1a1a2e' : btn.color + '20' },
              index === 0 && styles.toolButtonFirst,
            ]}
            onPress={btn.action}
            disabled={btn.disabled || disabled || loading}
          >
            <Text style={[styles.toolIcon, btn.disabled && styles.toolIconDisabled]}>
              {btn.icon}
            </Text>
            <Text style={[styles.toolLabel, btn.disabled && styles.toolLabelDisabled]}>
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#252540',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 5,
  },
  overlayPressable: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'flex-end',
    position: 'relative',
  },
  edgeTrigger: {
    position: 'absolute',
    right: 0,
    top: -100,
    bottom: 0,
    width: EDGE_THRESHOLD,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  edgeIndicator: {
    width: 6,
    height: 50,
    backgroundColor: '#3b82f6',
    borderRadius: 3,
    opacity: 0.6,
  },
  edgeBar: {
    width: 4,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  sidebar: {
    position: 'absolute',
    right: 0,
    bottom: '100%',
    width: SIDEBAR_WIDTH,
    backgroundColor: '#1e1e2e',
    borderBottomLeftRadius: 16,
    borderTopLeftRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#252540',
    borderRightWidth: 0,
    zIndex: 10,
    maxHeight: 480,
  },
  toolButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  toolButtonFirst: {
    backgroundColor: '#3b82f6',
  },
  toolIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  toolIconDisabled: {
    opacity: 0.4,
  },
  toolLabel: {
    color: '#888',
    fontSize: 12,
  },
  toolLabelDisabled: {
    color: '#444',
  },
});
