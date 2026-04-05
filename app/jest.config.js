module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      caller: { name: 'metro', bundler: 'metro', platform: 'ios' },
      presets: ['module:babel-preset-expo'],
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|zustand|socket.io-client))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mock 原生模块
    '^expo-camera$': '<rootDir>/__mocks__/expo-camera.js',
    '^expo-clipboard$': '<rootDir>/__mocks__/expo-clipboard.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-linear-gradient$': '<rootDir>/__mocks__/expo-linear-gradient.js',
    '^expo-status-bar$': '<rootDir>/__mocks__/expo-status-bar.js',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    '^react-native-gesture-handler$': '<rootDir>/__mocks__/react-native-gesture-handler.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    '^react-native-screens$': '<rootDir>/__mocks__/react-native-screens.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
