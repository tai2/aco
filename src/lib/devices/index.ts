import { listAndroidRealDevices } from './android-real.js';
import { listAndroidAvds } from './android.js';
import { listIosRealDevices } from './ios-real.js';
import { listIosSimulators } from './ios.js';
import type { ListResult, Platform } from './types.js';

export type {
  Device,
  DeviceKind,
  DeviceState,
  ListResult,
  Platform,
} from './types.js';

export { listIosSimulators } from './ios.js';
export { listIosRealDevices } from './ios-real.js';
export { listAndroidAvds } from './android.js';
export { listAndroidRealDevices } from './android-real.js';

function merge(results: ListResult[]): ListResult {
  return {
    devices: results.flatMap((r) => r.devices),
    notes: results.flatMap((r) => r.notes),
  };
}

export async function listIos(): Promise<ListResult> {
  return merge(await Promise.all([listIosSimulators(), listIosRealDevices()]));
}

export async function listAndroid(): Promise<ListResult> {
  const [avds, real] = await Promise.all([
    listAndroidAvds(),
    listAndroidRealDevices(),
  ]);
  // Reconcile: a running emulator shows up both as an AVD `.ini` definition
  // (id = AVD name) and as an adb serial (id = emulator-5554, avdName = AVD
  // name). Drop the `.ini` row whose name matches a running emulator's avdName
  // so the booted instance is the single source of truth for that AVD.
  const runningAvdNames = new Set(
    real.devices
      .filter((d) => d.kind === 'emulator' && d.avdName)
      .map((d) => d.avdName as string),
  );
  const avdDefs = {
    ...avds,
    devices: avds.devices.filter((d) => !runningAvdNames.has(d.name)),
  };
  return merge([avdDefs, real]);
}

export async function listAllDevices(platform?: Platform): Promise<ListResult> {
  if (platform === 'ios') return listIos();
  if (platform === 'android') return listAndroid();
  return merge(await Promise.all([listIos(), listAndroid()]));
}
