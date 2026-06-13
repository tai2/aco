import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Device, DeviceState, ListResult } from './types.js';

const execFileP = promisify(execFile);

interface SimctlListDeviceEntry {
  udid: string;
  name: string;
  state: string;
  isAvailable?: boolean;
  availability?: string;
}

interface SimctlListDevicesJson {
  devices: Record<string, SimctlListDeviceEntry[]>;
}

const RUNTIME_PREFIX = 'com.apple.CoreSimulator.SimRuntime.';

function runtimeToVersion(runtime: string): string | undefined {
  const m = /(\d+(?:\.\d+){0,2})$/.exec(runtime);
  return m?.[1];
}

function mapIosState(e: SimctlListDeviceEntry): DeviceState {
  if (e.isAvailable === false) return 'unavailable';
  if (
    typeof e.availability === 'string' &&
    /unavailable/i.test(e.availability)
  ) {
    return 'unavailable';
  }
  if (e.state === 'Booted') return 'booted';
  return 'available';
}

export async function listIosSimulators(): Promise<ListResult> {
  let raw: string;
  try {
    const { stdout } = await execFileP(
      'xcrun',
      ['simctl', 'list', '-j', 'devices'],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    raw = stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === 'ENOENT') {
      return {
        devices: [],
        notes: [
          'iOS skipped: `xcrun` not found on PATH. ' +
            'Install Xcode command line tools: `xcode-select --install`.',
        ],
      };
    }
    if (
      typeof e.stderr === 'string' &&
      /unable to find utility "simctl"/i.test(e.stderr)
    ) {
      return {
        devices: [],
        notes: [
          'iOS skipped: `xcrun simctl` not available. ' +
            'Install Xcode (not just the CLT) and run ' +
            '`sudo xcode-select -s /Applications/Xcode.app`.',
        ],
      };
    }
    return {
      devices: [],
      notes: [`iOS skipped: ${e.message}`],
    };
  }

  let parsed: SimctlListDevicesJson;
  try {
    parsed = JSON.parse(raw) as SimctlListDevicesJson;
  } catch (err) {
    return {
      devices: [],
      notes: [
        `iOS skipped: failed to parse simctl JSON: ${(err as Error).message}`,
      ],
    };
  }

  const out: Device[] = [];
  for (const [rawRuntime, entries] of Object.entries(parsed.devices ?? {})) {
    const runtime = rawRuntime.startsWith(RUNTIME_PREFIX)
      ? rawRuntime.slice(RUNTIME_PREFIX.length).replace(/-/g, '.')
      : rawRuntime;
    const platformVersion = runtimeToVersion(runtime);
    for (const e of entries) {
      out.push({
        id: e.udid,
        name: e.name,
        platform: 'ios',
        kind: 'simulator',
        state: mapIosState(e),
        platformVersion,
        runtime,
      });
    }
  }
  return { devices: out, notes: [] };
}
