/**
 * React Native 核心 mock
 * 提供最小化 RN 组件和 API 的测试替身
 */

const React = require('react');

// 基础 RN 组件 mock
const mockComponent = (name) => {
  const comp = React.forwardRef((props, ref) => {
    const { children, testID, ...rest } = props || {};
    return React.createElement(name, { ...rest, testID, ref }, children);
  });
  comp.displayName = name;
  return comp;
};

// 样式表 mock
const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
  compose: (a, b) => [a, b],
  absoluteFillObject: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};

// Animated mock
const Animated = {
  Value: class extends React.Component {},
  View: mockComponent('Animated.View'),
  Text: mockComponent('Animated.Text'),
  Image: mockComponent('Animated.Image'),
  ScrollView: mockComponent('Animated.ScrollView'),
  timing: () => ({ start: jest.fn(), stop: jest.fn() }),
  loop: () => ({ start: jest.fn(), stop: jest.fn() }),
  sequence: (...args) => args,
  parallel: (...args) => ({ start: jest.fn(), stop: jest.fn() }),
  delay: () => ({}),
  spring: () => ({ start: jest.fn() }),
  decay: () => ({ start: jest.fn() }),
  event: () => jest.fn(),
  interpolate: () => ({ interpolate: jest.fn() }),
};

// Platform mock
const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.native || obj.default,
  Version: 17,
};

// Dimensions mock
const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Keyboard mock
const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
};

// Alert mock
const Alert = {
  alert: jest.fn(),
};

// Clipboard mock
const Clipboard = {
  getString: jest.fn(),
  setString: jest.fn(),
};

// FlatList / ScrollView / etc.
const FlatList = React.forwardRef(({ data, renderItem, keyExtractor, testID, ...rest }, ref) => {
  return React.createElement('FlatList', { testID, ref, ...rest },
    data?.map?.((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      return React.createElement(React.Fragment, { key }, renderItem?.({ item, index }));
    })
  );
});

// PixelRatio
const PixelRatio = {
  get: () => 3,
  getPixelSizeForLayoutSize: (size) => size * 3,
  roundToNearestPixel: (size) => Math.round(size),
};

// 其他常用 API
const Easing = {
  inOut: (fn) => fn,
  ease: { factory: jest.fn() },
  linear: { factory: jest.fn() },
};

const LayoutAnimation = {
  configureNext: jest.fn(),
  Presets: { easeInEaseOut: {}, linear: {}, spring: {} },
};

const I18nManager = {
  isRTL: false,
  allowRTL: jest.fn(),
  forceRTL: jest.fn(),
  swapLeftAndRightInRTL: jest.fn(),
};

const StatusBar = {
  setBarStyle: jest.fn(),
  setHidden: jest.fn(),
  setNetworkActivityIndicatorVisible: jest.fn(),
  setBackgroundColor: jest.fn(),
  setTranslucent: jest.fn(),
  currentHeight: 44,
};

// React API
const forwardRef = React.forwardRef;
const createContext = React.createContext;
const memo = React.memo;
const Fragment = React.Fragment;

module.exports = {
  // 组件
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  TextInput: React.forwardRef((props, ref) =>
    React.createElement('TextInput', { ...props, ref })
  ),
  TouchableOpacity: mockComponent('TouchableOpacity'),
  Pressable: mockComponent('Pressable'),
  Image: mockComponent('Image'),
  ScrollView: mockComponent('ScrollView'),
  FlatList,
  SafeAreaView: mockComponent('SafeAreaView'),
  KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
  ActivityIndicator: mockComponent('ActivityIndicator'),
  RefreshControl: mockComponent('RefreshControl'),

  // API
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  Keyboard,
  Alert,
  Clipboard,
  PixelRatio,
  Easing,
  LayoutAnimation,
  I18nManager,
  StatusBar,

  // hooks
  useColorScheme: () => 'dark',
  useWindowDimensions: () => ({ width: 375, height: 812 }),

  // AppState
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },

  // React API (被其他 mock 需要)
  forwardRef: React.forwardRef,
  createElement: React.createElement,

  // React API（被其他 mock 需要）
  forwardRef: React.forwardRef,
  createElement: React.createElement,
  memo: React.memo,

  // NativeModules
  NativeModules: {},
  NativeEventEmitter: class {
    addListener = jest.fn();
    removeListener = jest.fn();
  },
  TurboModuleRegistry: {
    getEnforcing: jest.fn(),
    get: jest.fn(),
  },
  requireNativeComponent: (name) => mockComponent(name),
};
