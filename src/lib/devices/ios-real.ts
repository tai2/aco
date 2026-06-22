import { quietAppiumLog } from './appium-log.js';
import type { Device, ListResult } from './types.js';

export async function listIosRealDevices(): Promise<ListResult> {
  // Loaded lazily: `appium-ios-device` pulls in `@appium/support` ->
  // `read-pkg` (ESM-only) -> `unicorn-magic`, whose subpath exports the `tsx`
  // dev runtime cannot resolve. A static top-level import would crash the whole
  // CLI at startup under `pnpm dev`; a guarded dynamic import degrades to a note
  // there while staying fully functional under the built `node dist` runtime.
  let utilities: typeof import('appium-ios-device').utilities;
  try {
    ({ utilities } = await import('appium-ios-device'));
  } catch (err) {
    return {
      devices: [],
      notes: [
        `iOS real-device discovery unavailable in this runtime: ${(err as Error).message}`,
      ],
    };
  }
  quietAppiumLog();

  let udids: string[];
  try {
    udids = await utilities.getConnectedDevices();
  } catch (err) {
    return {
      devices: [],
      notes: [
        `iOS real devices skipped: ${(err as Error).message}. Connect the device via USB and trust this computer.`,
      ],
    };
  }

  const devices: Device[] = [];
  const notes: string[] = [];
  for (const udid of udids) {
    let name = udid;
    let platformVersion: string | undefined;
    try {
      name = await utilities.getDeviceName(udid);
    } catch {
      notes.push(
        `iOS real device ${udid}: could not read name (locked/untrusted?).`,
      );
    }
    try {
      platformVersion = await utilities.getOSVersion(udid);
    } catch {
      // leave version blank
    }
    devices.push({
      id: udid,
      name,
      platform: 'ios',
      kind: 'real',
      // A connected, trusted device is reachable -> treat as "booted" so it
      // ranks first and shows under the default `--state available` filter.
      state: 'booted',
      platformVersion,
    });
  }
  return { devices, notes };
}
