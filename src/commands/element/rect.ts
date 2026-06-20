import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementRect(element: Command): void {
  addConnectionFlags(
    element
      .command('rect')
      .description(
        'get the element rect {x,y,width,height} (GET /element/:id/rect)',
      ),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .action(async (opts) => {
      const value = await runWithSession(opts, (b) =>
        b.getElementRect(opts.element),
      );
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
}
