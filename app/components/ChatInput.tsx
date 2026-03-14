/**
 * 消息输入组件
 * 支持剪贴板粘贴、长按菜单（复制/全选/选取）
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

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
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<TextInput>(null);

  // 粘贴剪贴板内容
  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        // 在光标位置插入文本
        const before = text.substring(0, selection.start);
        const after = text.substring(selection.end);
        const newText = before + clipboardText + after;
        setText(newText);
        // 更新光标位置
        const newCursor = selection.start + clipboardText.length;
        setSelection({ start: newCursor, end: newCursor });
      }
    } catch (err) {
      console.error('粘贴失败:', err);
    }
    setShowMenu(false);
  }, [text, selection]);

  // 复制选中内容
  const handleCopy = useCallback(async () => {
    if (selection.start !== selection.end) {
      const selectedText = text.substring(selection.start, selection.end);
      await Clipboard.setStringAsync(selectedText);
    }
    setShowMenu(false);
  }, [text, selection]);

  // 全选
  const handleSelectAll = useCallback(() => {
    setSelection({ start: 0, end: text.length });
    setShowMenu(false);
    inputRef.current?.focus();
  }, [text.length]);

  // 发送消息
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || loading) return;

    onSend(trimmed);
    setText('');
    Keyboard.dismiss();
  };

  // 长按显示菜单
  const handleLongPress = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX, y: pageY });
    setShowMenu(true);
  };

  // 菜单项
  const menuItems = [
    { label: '粘贴', action: handlePaste, icon: '📋' },
    { label: '复制', action: handleCopy, icon: '📄', disabled: selection.start === selection.end },
    { label: '全选', action: handleSelectAll, icon: '📝', disabled: text.length === 0 },
  ];

  // 工具栏按钮配置
  const toolbarButtons = {
    // A列：左对齐，固定大小（暂时空置）
    left: [],
    // C列：居中，固定大小
    center: [
      { label: 'ctrl', onPress: () => {}, icon: '⌃' },
      { label: 'ctrl', onPress: () => {}, icon: '⌃' },
      { label: 'ctrl', onPress: () => {}, icon: '⌃' },
      { label: 'ctrl', onPress: () => {}, icon: '⌃' },
    ],
    // E列：右对齐，固定大小 - enter 用大按钮样式
    right: [
      { label: 'enter', onPress: handleSend, icon: '↵' },
      { label: 'new', onPress: () => {}, icon: '+' },
    ],
    // B列：弹性，小按钮 - tab, space, esc
    flexLeft: [
      { label: 'tab', onPress: () => {}, icon: '⇥' },
      { label: 'space', onPress: () => {}, icon: '␣' },
      { label: 'esc', onPress: () => {}, icon: '⎋' },
    ],
    // D列：弹性，小按钮
    flexRight: [
      { label: '粘贴', onPress: handlePaste, icon: '📋' },
      { label: '复制', onPress: handleCopy, icon: '📄' },
      { label: '全选', onPress: handleSelectAll, icon: '📝' },
      { label: '更多', onPress: () => {}, icon: '⋯' },
    ],
  };

  return (
    <View style={styles.container}>
      {/* 工具栏 - 5列布局 */}
      <View style={styles.toolbar}>
        {/* A列：左对齐，固定大小 */}
        <View style={styles.columnFixed}>
          {toolbarButtons.left.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={styles.fixedButton}
              onPress={btn.onPress}
              disabled={disabled || loading}
            >
              <Text style={styles.fixedButtonIcon}>{btn.icon}</Text>
              <Text style={styles.fixedButtonLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* B列：弹性 */}
        <View style={styles.columnFlex}>
          {toolbarButtons.flexLeft.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={styles.flexButton}
              onPress={btn.onPress}
              disabled={disabled || loading}
            >
              <Text style={styles.flexButtonIcon}>{btn.icon}</Text>
              <Text style={styles.flexButtonLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* C列：居中，固定大小 */}
        <View style={styles.columnFixed}>
          {toolbarButtons.center.map((btn, index) => (
            <TouchableOpacity
              key={`ctrl-${index}`}
              style={styles.fixedButton}
              onPress={btn.onPress}
              disabled={disabled || loading}
            >
              <Text style={styles.fixedButtonIcon}>{btn.icon}</Text>
              <Text style={styles.fixedButtonLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* D列：弹性 */}
        <View style={styles.columnFlex}>
          {toolbarButtons.flexRight.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={styles.flexButton}
              onPress={btn.onPress}
              disabled={disabled || loading}
            >
              <Text style={styles.flexButtonIcon}>{btn.icon}</Text>
              <Text style={styles.flexButtonLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* E列：右对齐，固定大小 */}
        <View style={styles.columnFixed}>
          {toolbarButtons.right.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={styles.fixedButton}
              onPress={btn.onPress}
              disabled={disabled || loading}
            >
              <Text style={styles.fixedButtonIcon}>{btn.icon}</Text>
              <Text style={styles.fixedButtonLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 输入区域 */}
      <View style={styles.inputRow}>
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
            <Text style={styles.sendButtonText}>发送</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 长按菜单 */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View
            style={[
              styles.menuContainer,
              { left: menuPosition.x - 80, top: menuPosition.y - 120 },
            ]}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  item.disabled && styles.menuItemDisabled,
                  index === menuItems.length - 1 && styles.menuItemLast,
                ]}
                onPress={item.action}
                disabled={item.disabled}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuLabel, item.disabled && styles.menuLabelDisabled]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#252540',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#252540',
  },
  // 固定宽度列（A、C、E列）
  columnFixed: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  // 弹性列（B、D列）
  columnFlex: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  // 固定大小按钮（和发送按钮一样大）
  fixedButton: {
    backgroundColor: '#252540',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  fixedButtonIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  fixedButtonLabel: {
    color: '#888',
    fontSize: 10,
  },
  // 弹性按钮（较小）
  flexButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#252540',
    borderRadius: 16,
    gap: 4,
  },
  flexButtonIcon: {
    fontSize: 12,
  },
  flexButtonLabel: {
    color: '#888',
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'flex-end',
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a5a',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuIcon: {
    fontSize: 16,
  },
  menuLabel: {
    color: '#fff',
    fontSize: 15,
  },
  menuLabelDisabled: {
    color: '#666',
  },
});
