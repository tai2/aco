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
}

export interface ListResult {
  devices: Device[];
  notes: string[];
}
