import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementProperty(element: Command): void {
  addConnectionFlags(
    element
      .command('property')
      .description(
        'read an element property (GET /element/:id/property/:name)',
      ),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .requiredOption('-n, --name <prop>', 'property name')
    .action(async (opts) => {
      const value = await runWithSession(opts, (b) =>
        b.getElementProperty(opts.element, opts.name),
      );
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
}
