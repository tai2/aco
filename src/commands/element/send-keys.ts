import type { Command } from '@commander-js/extra-typings';
import { runWithSession } from '../../lib/run-with-session.js';
import { addConnectionFlags } from '../../lib/connection.js';

export function registerElementSendKeys(element: Command): void {
  addConnectionFlags(
    element
      .command('send-keys')
      .description('send keys to an element (POST /element/:id/value)'),
  )
    .requiredOption('-e, --element <id>', 'element id')
    .requiredOption('-t, --text <value>', 'text to type')
    .action(async (opts) => {
      await runWithSession(opts, (b) =>
        b.elementSendKeys(opts.element, opts.text),
      );
      process.stdout.write('ok\n');
    });
}
