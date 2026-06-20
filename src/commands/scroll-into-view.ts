import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

type Direction = 'up' | 'down' | 'left' | 'right';

export function registerScrollIntoView(program: Command): void {
  addConnectionFlags(
    program
      .command('scroll-into-view')
      .description(
        "scroll a native element into view (WebdriverIO's element.scrollIntoView; " +
          'swipes until the element is displayed)',
      ),
  )
    .argument(
      '<selector>',
      'WDIO selector string for the target (e.g. ' +
        '"accessibility id:gestures.row.29", "xpath://...", "css selector:...")',
    )
    .option('-d, --direction <dir>', 'scroll direction: up|down|left|right')
    .option('--max-scrolls <n>', 'max swipes before giving up', (v) =>
      Number.parseInt(v, 10),
    )
    .option('--duration <ms>', 'duration of each swipe in ms', (v) =>
      Number.parseInt(v, 10),
    )
    .option(
      '--percent <0..1>',
      'fraction of the scrollable element to swipe',
      (v) => Number.parseFloat(v),
    )
    .option(
      '--scrollable <selector>',
      'WDIO selector string for the scrollable container ' +
        '(defaults to the platform default scroll view)',
    )
    .action(async (selector, opts) => {
      const dir = opts.direction as Direction | undefined;

      await runWithSession(opts, async (b) => {
        const target = await b.$(selector);

        const scrollableElement = opts.scrollable
          ? await b.$(opts.scrollable)
          : undefined;

        // Forward only the options the user set; WDIO owns the defaults
        // (maxScrolls: 10, direction: 'up', duration: 1500, percent: 0.95).
        await target.scrollIntoView({
          ...(dir ? { direction: dir } : {}),
          ...(opts.maxScrolls != null ? { maxScrolls: opts.maxScrolls } : {}),
          ...(opts.duration != null ? { duration: opts.duration } : {}),
          ...(opts.percent != null ? { percent: opts.percent } : {}),
          ...(scrollableElement ? { scrollableElement } : {}),
        });
      });
      process.stdout.write('ok\n');
    });
}
