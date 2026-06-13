import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementAttribute(element: Command): void {
  addConnectionFlags(
    element
      .command('attribute')
      .description(
        'read an element attribute (GET /element/:id/attribute/:name)',
      ),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .requiredOption('-n, --name <attr>', 'attribute name')
    .action(async (opts) => {
      const value = await runWithSession(opts, (b) =>
        b.getElementAttribute(opts.element, opts.name),
      );
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
}
