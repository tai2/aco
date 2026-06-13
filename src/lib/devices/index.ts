import { listIosSimulators } from './ios.js';
import { listAndroidAvds } from './android.js';
import type { ListResult, Platform } from './types.js';

export type {
  Device,
  DeviceKind,
  DeviceState,
  ListResult,
  Platform,
} from './types.js';

export { listIosSimulators } from './ios.js';
export { listAndroidAvds } from './android.js';

export async function listAllDevices(
  platform?: Platform,
): Promise<ListResult> {
  if (platform === 'ios') return listIosSimulators();
  if (platform === 'android') return listAndroidAvds();
  const [ios, android] = await Promise.all([
    listIosSimulators(),
    listAndroidAvds(),
  ]);
  return {
    devices: [...ios.devices, ...android.devices],
    notes: [...ios.notes, ...android.notes],
  };
}
