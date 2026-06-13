import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerContextCurrent(context: Command): void {
  addConnectionFlags(
    context.command('current').description('print the active context name'),
  ).action(async (opts) => {
    const name = await runWithSession(opts, (b) => b.getContext());
    process.stdout.write(`${String(name)}\n`);
  });
}
