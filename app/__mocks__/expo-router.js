module.exports = {
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  useNavigation: jest.fn(() => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
  })),
  Stack: {
    Screen: ({ children }) => children,
  },
  Link: ({ children }) => children,
  Redirect: () => null,
  Slot: ({ children }) => children,
  Tabs: {
    Screen: ({ children }) => children,
  },
};
