import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementSelected(element: Command): void {
  addConnectionFlags(
    element
      .command('selected')
      .description('is the element selected? (GET /element/:id/selected)'),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .action(async (opts) => {
      const value = await runWithSession(opts, (b) =>
        b.isElementSelected(opts.element),
      );
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
}
