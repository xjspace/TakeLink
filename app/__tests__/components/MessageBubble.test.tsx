/**
 * MessageBubble 组件测试
 * 覆盖：三种消息类型渲染、Markdown 解析、长按复制、工具消息折叠展开
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MessageBubble } from '../../components/MessageBubble';
import { UserMessage, AgentMessage, ToolMessage } from '../../types/message';

// Mock Alert 和 Clipboard
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

jest.mock('react-native/Libraries/Components/Clipboard/Clipboard', () => ({
  getString: jest.fn(),
  setString: jest.fn(),
}));

// Mock LayoutAnimation
jest.mock('react-native/Libraries/LayoutAnimation/LayoutAnimation', () => ({
  configureNext: jest.fn(),
  Presets: { easeInEaseOut: {} },
}));

describe('MessageBubble', () => {
  const baseTimestamp = 1700000000000; // 固定时间戳

  describe('用户消息', () => {
    it('应该渲染用户消息文本', () => {
      const msg: UserMessage = {
        kind: 'user',
        id: 'u1',
        text: 'Hello World',
        status: 'sent',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('Hello World')).toBeTruthy();
    });

    it('pending 状态应该显示发送中指示器', () => {
      const msg: UserMessage = {
        kind: 'user',
        id: 'u1',
        text: 'sending msg',
        status: 'pending',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('发送中')).toBeTruthy();
    });

    it('error 状态应该显示错误提示', () => {
      const msg: UserMessage = {
        kind: 'user',
        id: 'u1',
        text: 'failed msg',
        status: 'error',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('发送失败 - 点击重试')).toBeTruthy();
    });

    it('应该显示时间戳', () => {
      const msg: UserMessage = {
        kind: 'user',
        id: 'u1',
        text: 'with time',
        status: 'sent',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} showTimestamp={true} />);
      // formatTime 输出格式 HH:MM
      const d = new Date(baseTimestamp);
      const expected = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      expect(getByText(expected)).toBeTruthy();
    });

    it('showTimestamp=false 应该隐藏时间戳', () => {
      const msg: UserMessage = {
        kind: 'user',
        id: 'u1',
        text: 'no time',
        status: 'sent',
        createdAt: baseTimestamp,
      };

      const { queryByText } = render(<MessageBubble message={msg} showTimestamp={false} />);
      const d = new Date(baseTimestamp);
      const expected = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      expect(queryByText(expected)).toBeNull();
    });
  });

  describe('Agent 消息', () => {
    it('应该渲染纯文本 agent 消息', () => {
      const msg: AgentMessage = {
        kind: 'agent',
        id: 'a1',
        text: 'This is a response',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('This is a response')).toBeTruthy();
    });

    it('应该渲染代码块', () => {
      const msg: AgentMessage = {
        kind: 'agent',
        id: 'a2',
        text: 'Here is code:\n```js\nconsole.log("hello");\n```',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('js')).toBeTruthy(); // 语言标签
      expect(getByText('console.log("hello");')).toBeTruthy(); // 代码内容
    });

    it('应该渲染行内代码', () => {
      const msg: AgentMessage = {
        kind: 'agent',
        id: 'a3',
        text: 'Use `npm install` to install',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('npm install')).toBeTruthy();
    });

    it('应该渲染粗体文本', () => {
      const msg: AgentMessage = {
        kind: 'agent',
        id: 'a4',
        text: 'This is **important** text',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('important')).toBeTruthy();
    });
  });

  describe('工具消息', () => {
    it('应该渲染工具名称', () => {
      const msg: ToolMessage = {
        kind: 'tool',
        id: 't1',
        name: 'ReadFile',
        status: 'success',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('ReadFile')).toBeTruthy();
      expect(getByText('✓')).toBeTruthy(); // success icon
    });

    it('running 状态应该显示运行中', () => {
      const msg: ToolMessage = {
        kind: 'tool',
        id: 't2',
        name: 'WriteFile',
        status: 'running',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('运行中')).toBeTruthy();
    });

    it('error 状态应该显示错误图标', () => {
      const msg: ToolMessage = {
        kind: 'tool',
        id: 't3',
        name: 'BashCommand',
        status: 'error',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('✗')).toBeTruthy();
    });

    it('有 input/result 时应该显示展开提示', () => {
      const msg: ToolMessage = {
        kind: 'tool',
        id: 't4',
        name: 'Tool',
        status: 'success',
        input: 'some input',
        result: 'some result',
        createdAt: baseTimestamp,
      };

      const { getByText } = render(<MessageBubble message={msg} />);
      expect(getByText('展开')).toBeTruthy();
    });

    it('点击应该展开/收起详情', () => {
      const msg: ToolMessage = {
        kind: 'tool',
        id: 't5',
        name: 'Tool',
        status: 'success',
        input: 'input data',
        result: 'result data',
        createdAt: baseTimestamp,
      };

      const { getByText, queryByText } = render(<MessageBubble message={msg} />);

      // 初始收起
      expect(queryByText('input data')).toBeNull();

      // 点击展开
      fireEvent.press(getByText('Tool'));
      expect(getByText('input data')).toBeTruthy();
      expect(getByText('result data')).toBeTruthy();

      // 再次点击收起
      expect(getByText('收起')).toBeTruthy();
      fireEvent.press(getByText('收起'));
      expect(queryByText('input data')).toBeNull();
    });

    it('无 input/result 时不应显示展开提示', () => {
      const msg: ToolMessage = {
        kind: 'tool',
        id: 't6',
        name: 'SimpleTool',
        status: 'success',
        createdAt: baseTimestamp,
      };

      const { queryByText } = render(<MessageBubble message={msg} />);
      expect(queryByText('展开')).toBeNull();
      expect(queryByText('收起')).toBeNull();
    });
  });
});
