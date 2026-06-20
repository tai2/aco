import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementDisplayed(element: Command): void {
  addConnectionFlags(
    element
      .command('displayed')
      .description('is the element displayed? (GET /element/:id/displayed)'),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .action(async (opts) => {
      const value = await runWithSession(opts, (b) =>
        b.isElementDisplayed(opts.element),
      );
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
}
