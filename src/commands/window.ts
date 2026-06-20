import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerWindow(program: Command): void {
  const window = program
    .command('window')
    .description('inspect the active window');

  addConnectionFlags(
    window
      .command('rect')
      .description('get the window rect {x,y,width,height} (GET /window/rect)'),
  ).action(async (opts) => {
    const value = await runWithSession(opts, (b) => b.getWindowRect());
    process.stdout.write(`${JSON.stringify(value)}\n`);
  });
}
