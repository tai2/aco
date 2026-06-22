import { describe, expect, it, vi } from 'vitest';
import { mapAdbState } from '../src/lib/devices/android-real.js';
import type { ListResult } from '../src/lib/devices/types.js';

describe('mapAdbState', () => {
  it('maps authorized "device" to booted', () => {
    expect(mapAdbState('device')).toBe('booted');
  });
  it('maps "offline" to unavailable', () => {
    expect(mapAdbState('offline')).toBe('unavailable');
  });
  it('maps "unauthorized" (and anything else) to unknown', () => {
    expect(mapAdbState('unauthorized')).toBe('unknown');
    expect(mapAdbState('bootloader')).toBe('unknown');
  });
});

vi.mock('../src/lib/devices/ios.js', () => ({
  listIosSimulators: (): Promise<ListResult> =>
    Promise.resolve({ devices: [], notes: [] }),
}));
vi.mock('../src/lib/devices/ios-real.js', () => ({
  listIosRealDevices: (): Promise<ListResult> =>
    Promise.resolve({ devices: [], notes: [] }),
}));
vi.mock('../src/lib/devices/android.js', () => ({
  listAndroidAvds: (): Promise<ListResult> =>
    Promise.resolve({
      devices: [
        {
          id: 'Pixel_Tablet',
          name: 'Pixel_Tablet',
          platform: 'android',
          kind: 'emulator',
          state: 'unknown',
        },
        {
          id: 'Pixel_6_API_34',
          name: 'Pixel_6_API_34',
          platform: 'android',
          kind: 'emulator',
          state: 'unknown',
        },
      ],
      notes: [],
    }),
}));
vi.mock('../src/lib/devices/android-real.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/lib/devices/android-real.js')>();
  return {
    ...actual,
    listAndroidRealDevices: (): Promise<ListResult> =>
      Promise.resolve({
        devices: [
          {
            id: 'emulator-5554',
            name: 'Pixel_Tablet',
            platform: 'android',
            kind: 'emulator',
            avdName: 'Pixel_Tablet',
            state: 'booted',
          },
        ],
        notes: [],
      }),
  };
});

describe('listAndroid -- running-emulator reconciliation', () => {
  it('collapses the AVD .ini row whose name matches a running emulator avdName', async () => {
    const { listAndroid } = await import('../src/lib/devices/index.js');
    const { devices } = await listAndroid();
    const ids = devices.map((d) => d.id).sort();
    // The booted emulator-5554 row replaces the Pixel_Tablet .ini definition;
    // the unrelated Pixel_6_API_34 definition is untouched.
    expect(ids).toEqual(['Pixel_6_API_34', 'emulator-5554']);
    expect(devices.find((d) => d.id === 'emulator-5554')?.state).toBe('booted');
  });
});
