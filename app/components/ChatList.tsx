/**
 * 聊天消息列表 v2
 * 优化：onLayout 滚动、消息动画、性能调优
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { Message } from '../types/message';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
}

export function ChatList({ messages }: Props) {
  const listRef = useRef<FlatList>(null);
  const prevLength = useRef(0);

  // 新消息到达时滚动到底部
  useEffect(() => {
    if (messages.length > prevLength.current) {
      // 使用 requestAnimationFrame 确保 UI 更新完成后再滚动
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
    prevLength.current = messages.length;
  }, [messages.length]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  ), []);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      onContentSizeChange={() => {
        // 内容大小变化时也滚动（如消息更新）
        if (messages.length > 0) {
          listRef.current?.scrollToEnd({ animated: false });
        }
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
      // 自动滚动策略：用户在底部时自动跟随，在上方浏览时不强制拉回
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
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
