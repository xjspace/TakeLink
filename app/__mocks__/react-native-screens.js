module.exports = {
  enableScreens: jest.fn(),
  Screen: ({ children }) => children,
  ScreenContainer: ({ children }) => children,
  NativeScreen: ({ children }) => children,
  NativeScreenContainer: ({ children }) => children,
};
