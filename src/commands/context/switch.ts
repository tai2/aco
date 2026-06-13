import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerContextSwitch(context: Command): void {
  addConnectionFlags(
    context.command('switch').description('switch to a context by name'),
  )
    .requiredOption('-n, --name <context>', 'context name')
    .action(async (opts) => {
      await runWithSession(opts, (b) => b.switchContext(opts.name));
      process.stdout.write('ok\n');
    });
}
