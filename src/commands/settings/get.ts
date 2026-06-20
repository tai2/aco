import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerSettingsGet(settings: Command): void {
  addConnectionFlags(
    settings
      .command('get')
      .description('print the active driver settings (GET /appium/settings)'),
  ).action(async (opts) => {
    const value = await runWithSession(opts, (b) => b.getSettings());
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  });
}
