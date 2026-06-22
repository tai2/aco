export type Platform = 'ios' | 'android';

export type DeviceKind = 'simulator' | 'emulator' | 'real';

export type DeviceState = 'available' | 'booted' | 'unavailable' | 'unknown';

export interface Device {
  id: string;
  name: string;
  platform: Platform;
  kind: DeviceKind;
  state: DeviceState;
  platformVersion?: string;
  runtime?: string;
  // Set only on a running Android emulator row (the AVD name from `adb devices
  // -l`). Used by the index.ts merge to collapse the matching AVD `.ini`
  // definition row; not rendered.
  avdName?: string;
}

export interface ListResult {
  devices: Device[];
  notes: string[];
}
