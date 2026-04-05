const React = require('react');

module.exports = {
  SafeAreaProvider: ({ children }) => children,
  SafeAreaConsumer: ({ children }) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: React.forwardRef(({ children, ...props }, ref) =>
    React.createElement('SafeAreaView', { ...props, ref }, children)
  ),
};
