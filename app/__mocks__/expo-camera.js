module.exports = {
  CameraView: ({ children }) => children,
  useCameraPermissions: jest.fn(() => [
    { granted: false, canAskAgain: true },
    jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  ]),
};
