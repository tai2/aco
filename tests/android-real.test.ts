import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeVerboseDevice {
  udid: string;
  state: string;
  model: string;
}

let connectedDevices: FakeVerboseDevice[] = [];
let connectedEmulators: { udid: string }[] = [];

vi.mock('appium-adb', () => {
  const instance = {
    getConnectedDevices: () => Promise.resolve(connectedDevices),
    getConnectedEmulators: () => Promise.resolve(connectedEmulators),
    clone: () => ({ getPlatformVersion: () => Promise.resolve('14') }),
  };
  return { ADB: { createADB: () => Promise.resolve(instance) } };
});

const { listAndroidRealDevices } = await import(
  '../src/lib/devices/android-real.js'
);

describe('listAndroidRealDevices -- emulator vs real classification', () => {
  beforeEach(() => {
    connectedDevices = [];
    connectedEmulators = [];
  });

  it('classifies a running emulator (by getConnectedEmulators) and carries avdName', async () => {
    connectedDevices = [
      { udid: 'emulator-5554', state: 'device', model: 'Pixel_Tablet' },
    ];
    connectedEmulators = [{ udid: 'emulator-5554' }];

    const { devices } = await listAndroidRealDevices();
    expect(devices).toHaveLength(1);
    const d = devices[0];
    if (!d) throw new Error('expected a device');
    expect(d.kind).toBe('emulator');
    expect(d.avdName).toBe('Pixel_Tablet');
    expect(d.state).toBe('booted');
    expect(d.platformVersion).toBe('14');
  });

  it('classifies a USB handset as real with no avdName and a friendly model name', async () => {
    connectedDevices = [
      { udid: 'R5CN30XXXX', state: 'device', model: 'SM_G991B' },
    ];

    const { devices } = await listAndroidRealDevices();
    expect(devices).toHaveLength(1);
    const d = devices[0];
    if (!d) throw new Error('expected a device');
    expect(d.kind).toBe('real');
    expect(d.avdName).toBeUndefined();
    expect(d.name).toBe('SM_G991B');
  });

  it('notes an unauthorized device and leaves it visible as unknown', async () => {
    connectedDevices = [
      { udid: 'R5CN30XXXX', state: 'unauthorized', model: '' },
    ];

    const { devices, notes } = await listAndroidRealDevices();
    const d = devices[0];
    if (!d) throw new Error('expected a device');
    expect(d.state).toBe('unknown');
    expect(d.kind).toBe('real');
    expect(notes.some((n) => /unauthorized/.test(n))).toBe(true);
  });
});
