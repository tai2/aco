import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerContextList(context: Command): void {
  addConnectionFlags(
    context.command('list').description('list available contexts'),
  ).action(async (opts) => {
    const contexts = await runWithSession(opts, (b) => b.getContexts());
    process.stdout.write(`${JSON.stringify(contexts)}\n`);
  });
}
