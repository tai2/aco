import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { unwrapElementId } from '../../lib/locator.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerElementActive(element: Command): void {
  addConnectionFlags(
    element
      .command('active')
      .description('get the active (focused) element (GET /element/active)'),
  ).action(async (opts) => {
    const id = await runWithSession(opts, async (b) => {
      const el = (await b.getActiveElement()) as Record<string, string>;
      return unwrapElementId(el);
    });
    process.stdout.write(`${JSON.stringify(id)}\n`);
  });
}
