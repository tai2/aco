import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementClick(element: Command): void {
  addConnectionFlags(
    element
      .command('click')
      .description('click an element by id (POST /element/:id/click)'),
  )
    .requiredOption(
      '-e, --element <id>',
      'element id (from `aco element find`)',
    )
    .action(async (opts) => {
      await runWithSession(opts, (b) => b.elementClick(opts.element));
      process.stdout.write('ok\n');
    });
}
