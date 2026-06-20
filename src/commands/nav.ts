import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerNav(program: Command): void {
  for (const [name, method, desc] of [
    ['back', 'back', 'navigate back in history (web context)'],
    ['forward', 'forward', 'navigate forward in history (web context)'],
    ['refresh', 'refresh', 'reload the current page (web context)'],
  ] as const) {
    addConnectionFlags(program.command(name).description(desc)).action(
      async (opts) => {
        await runWithSession(opts, (b) => b[method]());
        process.stdout.write('ok\n');
      },
    );
  }
}
