import type { VerboseDevice } from 'appium-adb';
import { quietAppiumLog } from './appium-log.js';
import type { Device, DeviceState, ListResult } from './types.js';

// adb's `state` vocabulary -> aco's DeviceState.
function mapAdbState(adbState: string): DeviceState {
  if (adbState === 'device') return 'booted'; // reachable & authorized
  if (adbState === 'offline') return 'unavailable';
  return 'unknown'; // unauthorized, bootloader, ...
}

export async function listAndroidRealDevices(): Promise<ListResult> {
  // Loaded lazily: `appium-adb` pulls in `@appium/support` -> `read-pkg`
  // (ESM-only) -> `unicorn-magic`, whose subpath exports the `tsx` dev runtime
  // cannot resolve. A static top-level import would crash the whole CLI at
  // startup under `pnpm dev`; a guarded dynamic import degrades to a note there
  // while staying fully functional under the built `node dist` runtime.
  let ADB: typeof import('appium-adb').ADB;
  try {
    ({ ADB } = await import('appium-adb'));
  } catch (err) {
    return {
      devices: [],
      notes: [
        `Android real-device discovery unavailable in this runtime: ${(err as Error).message}`,
      ],
    };
  }
  quietAppiumLog();

  let adb: import('appium-adb').ADB;
  try {
    adb = await ADB.createADB();
  } catch (err) {
    return {
      devices: [],
      notes: [
        `Android real devices skipped: ${(err as Error).message}. Ensure the Android SDK platform-tools (adb) are installed and on PATH (set $ANDROID_HOME / $ANDROID_SDK_ROOT).`,
      ],
    };
  }

  const notes: string[] = [];
  // `adb devices -l` long format (verbose): serial, state, and trailing
  // descriptors (`product:` / `model:` / `device:` / `transport_id:`). The
  // `model:` descriptor carries the AVD name for emulators, which lets us
  // reconcile a running emulator against its AVD `.ini` definition row.
  let connected: VerboseDevice[];
  let emulatorSerials: Set<string>;
  try {
    connected = await adb.getConnectedDevices({ verbose: true });
    const emulators = await adb.getConnectedEmulators();
    emulatorSerials = new Set(emulators.map((e) => e.udid));
  } catch (err) {
    return {
      devices: [],
      notes: [`Android real devices skipped: ${(err as Error).message}.`],
    };
  }

  const devices: Device[] = [];
  for (const d of connected) {
    const isEmulator = emulatorSerials.has(d.udid) || /^emulator-/.test(d.udid);
    let platformVersion: string | undefined;
    if (d.state === 'device') {
      try {
        platformVersion = await adb
          .clone({ udid: d.udid })
          .getPlatformVersion();
      } catch {
        notes.push(
          `Android device ${d.udid}: could not read platform version.`,
        );
      }
    } else if (d.state === 'unauthorized') {
      notes.push(
        `Android device ${d.udid} is unauthorized -- accept the "Allow USB debugging" prompt on the device, then re-run.`,
      );
    }
    devices.push({
      id: d.udid,
      // The `model:` descriptor from the long format gives a friendly label
      // (the AVD name for emulators, the product model for handsets); fall back
      // to the serial when adb omits it.
      name: d.model || d.udid,
      platform: 'android',
      kind: isEmulator ? 'emulator' : 'real',
      // `avdName` carries the running emulator's AVD identity so the merge step
      // in index.ts can collapse the matching `.ini` definition row into this one.
      avdName: isEmulator ? d.model : undefined,
      state: mapAdbState(d.state),
      platformVersion,
    });
  }
  return { devices, notes };
}

export { mapAdbState };
