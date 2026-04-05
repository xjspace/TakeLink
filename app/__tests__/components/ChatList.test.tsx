/**
 * ChatList 组件测试
 * 覆盖：消息列表渲染、空列表、FlatList key 提取
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatList } from '../../components/ChatList';
import { Message } from '../../types/message';

// Mock MessageBubble
jest.mock('../../components/MessageBubble', () => ({
  MessageBubble: ({ message }: { message: any }) => {
    const { Text } = require('react-native');
    return <Text testID={`bubble-${message.id}`}>{message.text || message.name}</Text>;
  },
}));

describe('ChatList', () => {
  const createMessages = (count: number): Message[] => {
    return Array.from({ length: count }, (_, i) => ({
      kind: 'agent' as const,
      id: `msg-${i}`,
      text: `Message ${i}`,
      createdAt: Date.now() + i * 1000,
    }));
  };

  it('应该渲染空列表', () => {
    const { queryByTestId } = render(<ChatList messages={[]} />);
    expect(queryByTestId(/bubble-/)).toBeNull();
  });

  it('应该渲染所有消息', () => {
    const messages = createMessages(3);
    const { getByTestId } = render(<ChatList messages={messages} />);

    expect(getByTestId('bubble-msg-0')).toBeTruthy();
    expect(getByTestId('bubble-msg-1')).toBeTruthy();
    expect(getByTestId('bubble-msg-2')).toBeTruthy();
  });

  it('应该正确渲染大量消息', () => {
    const messages = createMessages(50);
    const { getByTestId } = render(<ChatList messages={messages} />);

    // FlatList 可能不会一次性渲染所有 item，但数据应该已传入
    expect(getByTestId('bubble-msg-0')).toBeTruthy();
  });

  it('应该支持混合消息类型', () => {
    const messages: Message[] = [
      { kind: 'user', id: 'u1', text: 'hello', status: 'sent', createdAt: 1 },
      { kind: 'agent', id: 'a1', text: 'hi', createdAt: 2 },
      { kind: 'tool', id: 't1', name: 'Read', status: 'success', createdAt: 3 },
    ];

    const { getByTestId } = render(<ChatList messages={messages} />);
    expect(getByTestId('bubble-u1')).toBeTruthy();
    expect(getByTestId('bubble-a1')).toBeTruthy();
    expect(getByTestId('bubble-t1')).toBeTruthy();
  });
});
