import type { Command } from '@commander-js/extra-typings';
import { runWithSession } from '../lib/run-with-session.js';
import { addConnectionFlags } from '../lib/connection.js';

export function registerSource(program: Command): void {
  addConnectionFlags(
    program
      .command('source')
      .description('print the current page source (W3C GET /source)'),
  ).action(async (opts) => {
    const xml = await runWithSession(opts, (b) => b.getPageSource());
    process.stdout.write(xml + '\n');
  });
}
