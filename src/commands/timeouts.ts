import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerTimeouts(program: Command): void {
  const timeouts = program
    .command('timeouts')
    .description('read / update the session timeouts (W3C /timeouts)');

  addConnectionFlags(
    timeouts
      .command('get')
      .description('print the active timeouts (GET /timeouts)'),
  ).action(async (opts) => {
    const value = await runWithSession(opts, (b) => b.getTimeouts());
    process.stdout.write(`${JSON.stringify(value)}\n`);
  });

  addConnectionFlags(
    timeouts
      .command('set')
      .description('set session timeouts (POST /timeouts)'),
  )
    .option('--implicit <ms>', 'implicit wait timeout', (v) =>
      Number.parseInt(v, 10),
    )
    .option('--page-load <ms>', 'page load timeout', (v) =>
      Number.parseInt(v, 10),
    )
    .option('--script <ms>', 'script timeout', (v) => Number.parseInt(v, 10))
    .action(async (opts) => {
      if (
        opts.implicit === undefined &&
        opts.pageLoad === undefined &&
        opts.script === undefined
      ) {
        throw new Error(
          'nothing to set: pass --implicit, --page-load, and/or --script',
        );
      }
      await runWithSession(opts, (b) =>
        b.setTimeouts(opts.implicit, opts.pageLoad, opts.script),
      );
      process.stdout.write('ok\n');
    });
}
