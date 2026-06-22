declare module 'appium-ios-device' {
  export const utilities: {
    getConnectedDevices(socket?: unknown): Promise<string[]>;
    getDeviceName(udid: string, socket?: unknown): Promise<string>;
    getOSVersion(udid: string, socket?: unknown): Promise<string>;
  };
}
