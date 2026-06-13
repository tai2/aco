import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementText(element: Command): void {
  addConnectionFlags(
    element
      .command('text')
      .description("read an element's text (GET /element/:id/text)"),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .action(async (opts) => {
      const text = await runWithSession(opts, (b) =>
        b.getElementText(opts.element),
      );
      process.stdout.write(`${text}\n`);
    });
}
