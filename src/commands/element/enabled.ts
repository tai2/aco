import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementEnabled(element: Command): void {
  addConnectionFlags(
    element
      .command('enabled')
      .description('is the element enabled? (GET /element/:id/enabled)'),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .action(async (opts) => {
      const value = await runWithSession(opts, (b) =>
        b.isElementEnabled(opts.element),
      );
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
}
