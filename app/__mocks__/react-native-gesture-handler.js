module.exports = {
  GestureHandlerRootView: ({ children }) => children,
  GestureDetector: ({ children }) => children,
  Gesture: {
    Tap: () => ({ onStart: jest.fn() }),
    Pan: () => ({ onStart: jest.fn() }),
    LongPress: () => ({ onStart: jest.fn() }),
  },
  Directions: {},
  State: {},
};
