import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

function parsePairs(values: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of values ?? []) {
    const idx = v.indexOf('=');
    if (idx < 0) throw new Error(`--set expects key=value, got "${v}"`);
    const key = v.slice(0, idx);
    const raw = v.slice(idx + 1);
    try {
      out[key] = JSON.parse(raw) as unknown;
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

export function registerSettingsSet(settings: Command): void {
  addConnectionFlags(
    settings
      .command('set')
      .description('update driver settings (POST /appium/settings)'),
  )
    .option('--set <key=value...>', 'a setting to update (repeatable)')
    .option('-j, --json <obj>', 'settings object as a single JSON blob')
    .action(async (opts) => {
      let body: Record<string, unknown> = {};
      if (opts.json) {
        try {
          body = JSON.parse(opts.json) as Record<string, unknown>;
        } catch (err) {
          throw new Error(
            `--json must be valid JSON: ${(err as Error).message}`,
          );
        }
      }
      body = { ...body, ...parsePairs(opts.set) };
      if (Object.keys(body).length === 0) {
        throw new Error('nothing to set: pass --set key=value or --json <obj>');
      }
      await runWithSession(opts, (b) => b.updateSettings(body));
      process.stdout.write('ok\n');
    });
}
