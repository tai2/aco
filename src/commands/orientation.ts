import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

const ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'] as const;

export function registerOrientation(program: Command): void {
  const orientation = program
    .command('orientation')
    .description('read / set the device orientation (JSONWP /orientation)');

  addConnectionFlags(
    orientation
      .command('get')
      .description('print the current device orientation (GET /orientation)'),
  ).action(async (opts) => {
    const value = await runWithSession(opts, (b) => b.getOrientation());
    process.stdout.write(`${value}\n`);
  });

  addConnectionFlags(
    orientation
      .command('set')
      .description('set the device orientation (POST /orientation)'),
  )
    .argument('<orientation>', 'PORTRAIT or LANDSCAPE')
    .action(async (orientationArg, opts) => {
      const normalized = orientationArg.toUpperCase();
      if (!(ORIENTATIONS as readonly string[]).includes(normalized)) {
        throw new Error(
          `invalid orientation "${orientationArg}": expected PORTRAIT or LANDSCAPE`,
        );
      }
      await runWithSession(opts, (b) => b.setOrientation(normalized));
      process.stdout.write('ok\n');
    });
}
