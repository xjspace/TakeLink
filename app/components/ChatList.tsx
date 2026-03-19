/**
 * 聊天消息列表
 */

import React, { useEffect, useRef } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { Message } from '../types/message';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
}

export function ChatList({ messages }: Props) {
  const listRef = useRef<FlatList>(null);

  // 新消息时滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      contentContainerStyle={styles.listContent}
      onContentSizeChange={() => {
        listRef.current?.scrollToEnd({ animated: false });
      }}
      ListFooterComponent={<View style={styles.bottomPadding} />}
      // 性能优化
      removeClippedSubviews={true}
      windowSize={5}
      initialNumToRender={10}
      maxToRenderPerBatch={5}
      updateCellsBatchingPeriod={50}
      // 滚动优化
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      // 键盘处理
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
  },
  bottomPadding: {
    height: 16,
  },
});
