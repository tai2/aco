import type { Command } from '@commander-js/extra-typings';
import { loadSnapshot } from '../../lib/method-map.js';

export function registerMobileList(mobile: Command): void {
  mobile
    .command('list')
    .description('list mobile: extensions advertised by the pinned driver')
    .requiredOption(
      '-p, --platform <ios|android>',
      'platform whose driver map to render',
    )
    .option('--json', 'emit JSON instead of human-readable')
    .option(
      '--versions',
      'show the driver package(s) + version(s) the bundled snapshot was generated from',
    )
    .action(async (opts) => {
      const platform = opts.platform.toLowerCase();
      if (platform !== 'ios' && platform !== 'android') {
        throw new Error(
          `--platform must be "ios" or "android" (got "${opts.platform}")`,
        );
      }
      const snapshot = loadSnapshot(platform);

      if (opts.versions) {
        if (opts.json) {
          process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
          return;
        }
        const entryCount = Object.keys(snapshot.methods).length;
        for (const d of snapshot.drivers) {
          process.stdout.write(
            `${d.package}@${d.version} (${entryCount} entries)\n`,
          );
        }
        return;
      }

      if (opts.json) {
        process.stdout.write(JSON.stringify(snapshot.methods, null, 2) + '\n');
        return;
      }
      for (const [name, spec] of Object.entries(snapshot.methods)) {
        const req = spec.params?.required?.join(',') ?? '';
        const opt = spec.params?.optional?.join(',') ?? '';
        process.stdout.write(
          `${name.padEnd(40)} required:[${req}] optional:[${opt}]\n`,
        );
      }
    });
}
