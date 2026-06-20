import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementClear(element: Command): void {
  addConnectionFlags(
    element
      .command('clear')
      .description('clear an element (POST /element/:id/clear)'),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .action(async (opts) => {
      await runWithSession(opts, (b) => b.elementClear(opts.element));
      process.stdout.write('ok\n');
    });
}
