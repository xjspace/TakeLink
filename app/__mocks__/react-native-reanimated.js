module.exports = {
  default: ({ children }) => children,
  useAnimatedStyle: () => ({}),
  useSharedValue: (initial) => ({ value: initial }),
  withTiming: (toValue) => toValue,
  withSpring: (toValue) => toValue,
  withSequence: (...args) => args,
  withRepeat: (animation) => animation,
  withDelay: (_, animation) => animation,
  Easing: { inOut: (fn) => fn, ease: {}, linear: {} },
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
};
