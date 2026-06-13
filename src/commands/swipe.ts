import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

type Direction = 'up' | 'down' | 'left' | 'right';

export function registerSwipe(program: Command): void {
  addConnectionFlags(
    program
      .command('swipe')
      .description('swipe (iOS: mobile: swipe, Android: mobile: swipeGesture)'),
  )
    .requiredOption('-d, --direction <dir>', 'up|down|left|right')
    .option('-e, --element <id>', 'element to swipe within')
    .option(
      '--percent <0..1>',
      'Android only -- swipe distance as fraction of element/viewport',
      (v) => Number.parseFloat(v),
      0.75,
    )
    .option('--velocity <num>', 'iOS only -- XCUITest velocity', (v) =>
      Number.parseFloat(v),
    )
    .action(async (opts) => {
      const dir = opts.direction as Direction;
      await runWithSession(opts, async (b, platform) => {
        if (platform === 'ios') {
          await b.execute('mobile: swipe', {
            direction: dir,
            ...(opts.element ? { elementId: opts.element } : {}),
            ...(opts.velocity != null ? { velocity: opts.velocity } : {}),
          });
        } else {
          await b.execute('mobile: swipeGesture', {
            direction: dir,
            percent: opts.percent,
            ...(opts.element ? { elementId: opts.element } : {}),
          });
        }
      });
      process.stdout.write('ok\n');
    });
}
