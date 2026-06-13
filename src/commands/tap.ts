import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerTap(program: Command): void {
  addConnectionFlags(
    program
      .command('tap')
      .description(
        'tap at coords or on an element (iOS: mobile: tap, Android: mobile: clickGesture)',
      ),
  )
    .option('-e, --element <id>', 'element id (optional)')
    .option('-x, --x <px>', 'x coordinate', (v) => Number.parseFloat(v))
    .option('-y, --y <px>', 'y coordinate', (v) => Number.parseFloat(v))
    .action(async (opts) => {
      await runWithSession(opts, async (b, platform) => {
        if (platform === 'ios') {
          if (opts.x == null || opts.y == null) {
            throw new Error(
              'iOS mobile: tap requires --x and --y on this driver.',
            );
          }
          await b.execute('mobile: tap', {
            x: opts.x,
            y: opts.y,
            ...(opts.element ? { elementId: opts.element } : {}),
          });
        } else {
          await b.execute('mobile: clickGesture', {
            ...(opts.element ? { elementId: opts.element } : {}),
            ...(opts.x != null ? { x: opts.x } : {}),
            ...(opts.y != null ? { y: opts.y } : {}),
          });
        }
      });
      process.stdout.write('ok\n');
    });
}
