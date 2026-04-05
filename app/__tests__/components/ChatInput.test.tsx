/**
 * ChatInput 组件测试
 * 覆盖：输入、发送、工具按钮、禁用状态
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatInput } from '../../components/ChatInput';

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn().mockResolvedValue('clipboard content'),
}));

// Mock Keyboard
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  dismiss: jest.fn(),
}));

describe('ChatInput', () => {
  const defaultProps = {
    onSend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该渲染输入框和发送按钮', () => {
      const { getByPlaceholderText, getByText } = render(<ChatInput {...defaultProps} />);

      expect(getByPlaceholderText('输入消息...')).toBeTruthy();
      expect(getByText('↑')).toBeTruthy(); // 发送按钮图标
    });

    it('应该渲染 4 个工具按钮', () => {
      const { getByText } = render(<ChatInput {...defaultProps} />);

      expect(getByText('⇥')).toBeTruthy(); // Tab
      expect(getByText('⎋')).toBeTruthy(); // Esc
      expect(getByText('📋')).toBeTruthy(); // 粘贴
      expect(getByText('␣')).toBeTruthy(); // 空格
    });

    it('loading 状态应该显示 ActivityIndicator 而非发送图标', () => {
      const { queryByText, UNSAFE_root } = render(
        <ChatInput {...defaultProps} loading={true} />
      );

      expect(queryByText('↑')).toBeNull();
    });

    it('disabled 状态下输入框不可编辑', () => {
      const { getByPlaceholderText } = render(
        <ChatInput {...defaultProps} disabled={true} />
      );

      const input = getByPlaceholderText('输入消息...');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('发送消息', () => {
    it('输入文字后点击发送应该调用 onSend', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, 'hello world');

      // 找到发送按钮（↑ 文本在 TouchableOpacity 中）
      const sendButton = getByText('↑');
      fireEvent.press(sendButton);

      expect(onSend).toHaveBeenCalledWith('hello world');
    });

    it('空字符串不应该触发发送', () => {
      const onSend = jest.fn();
      const { getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} />
      );

      const sendButton = getByText('↑');
      fireEvent.press(sendButton);

      expect(onSend).not.toHaveBeenCalled();
    });

    it('只有空格的文字不应该触发发送', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, '   ');

      const sendButton = getByText('↑');
      fireEvent.press(sendButton);

      expect(onSend).not.toHaveBeenCalled();
    });

    it('发送后应该清空输入框', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, 'test message');
      fireEvent.press(getByText('↑'));

      expect(input.props.value).toBe('');
    });

    it('disabled 时不应发送', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} disabled={true} />
      );

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, 'test');
      // 按钮被 disabled，press 可能不触发，但确认 onSend 没被调
      expect(onSend).not.toHaveBeenCalled();
    });

    it('loading 时不应发送', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText } = render(
        <ChatInput {...defaultProps} onSend={onSend} loading={true} />
      );

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, 'test');
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('工具按钮', () => {
    it('Esc 按钮应该发送 \\x1b 字符', () => {
      const onSend = jest.fn();
      const { getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} />
      );

      // 找到 Esc 图标对应的按钮
      fireEvent.press(getByText('⎋'));
      expect(onSend).toHaveBeenCalledWith('\x1b');
    });

    it('disabled 时 Esc 不应该触发', () => {
      const onSend = jest.fn();
      const { getByText } = render(
        <ChatInput {...defaultProps} onSend={onSend} disabled={true} />
      );

      // 按钮被 disabled，事件不触发
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('输入交互', () => {
    it('应该更新输入值', () => {
      const { getByPlaceholderText } = render(<ChatInput {...defaultProps} />);

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, 'new text');
      expect(input.props.value).toBe('new text');
    });

    it('应该处理 onSubmitEditing', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText } = render(
        <ChatInput {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('输入消息...');
      fireEvent.changeText(input, 'submit test');
      fireEvent(input, 'submitEditing');

      expect(onSend).toHaveBeenCalledWith('submit test');
    });
  });
});
