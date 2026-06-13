import type { Command } from '@commander-js/extra-typings';
import { renderTable, sortDevices } from '../../lib/devices/format.js';
import {
  type Device,
  type Platform,
  listAllDevices,
} from '../../lib/devices/index.js';

type StateFilter = 'available' | 'booted' | 'all';

const STATE_FILTERS: Record<StateFilter, (d: Device) => boolean> = {
  available: (d) => d.state !== 'unavailable',
  booted: (d) => d.state === 'booted',
  all: () => true,
};

function isStateFilter(value: string): value is StateFilter {
  return value === 'available' || value === 'booted' || value === 'all';
}

export function registerDeviceList(device: Command): void {
  device
    .command('list')
    .description(
      'list iOS Simulators (via `xcrun simctl`) and Android AVDs (via ' +
        '~/.android/avd) that you can pass to `aco session start`',
    )
    .option(
      '-p, --platform <ios|android>',
      'restrict to one platform (default: both)',
    )
    .option(
      '--state <available|booted|all>',
      'filter rows by state',
      'available',
    )
    .option('--json', 'emit JSON instead of a human-readable table')
    .action(async (opts) => {
      let platform: Platform | undefined;
      if (opts.platform) {
        const p = opts.platform.toLowerCase();
        if (p !== 'ios' && p !== 'android') {
          throw new Error(
            `--platform must be "ios" or "android" (got "${opts.platform}")`,
          );
        }
        platform = p;
      }

      const stateRaw = (opts.state ?? 'available').toLowerCase();
      if (!isStateFilter(stateRaw)) {
        throw new Error(
          `--state must be "available", "booted", or "all" (got "${opts.state}")`,
        );
      }
      const filter = STATE_FILTERS[stateRaw];

      const { devices, notes } = await listAllDevices(platform);
      const filtered = devices.filter(filter);

      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify({ devices: sortDevices(filtered), notes }, null, 2)}\n`,
        );
        return;
      }

      for (const n of notes) process.stderr.write(`aco: ${n}\n`);

      if (filtered.length === 0) {
        const hint =
          platform === 'ios'
            ? 'Install simulator runtimes via Xcode > Settings > Platforms.'
            : platform === 'android'
              ? 'Create an AVD via Android Studio > Virtual Device Manager.'
              : 'Install Xcode runtimes and/or an Android AVD first.';
        process.stderr.write(`no devices found. ${hint}\n`);
        return;
      }

      process.stdout.write(renderTable(filtered));
      process.stderr.write(
        'tip: `aco session start --platform ios --udid <ID>` ' +
          'or `--platform android --avd <NAME>`\n',
      );
    });
}
