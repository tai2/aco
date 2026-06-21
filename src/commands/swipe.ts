import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { W3C_ELEMENT_ID } from '../lib/locator.js';
import { runWithSession } from '../lib/run-with-session.js';

type Direction = 'up' | 'down' | 'left' | 'right';

function finiteNumber(flag: string, v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`${flag} must be a number (got "${v}")`);
  }
  return n;
}

function point(flag: string, v: string): { x: number; y: number } {
  const [x, y, ...rest] = v.split(',');
  if (x == null || y == null || rest.length > 0) {
    throw new Error(`${flag} must be "x,y" (got "${v}")`);
  }
  return {
    x: finiteNumber(flag, x),
    y: finiteNumber(flag, y),
  };
}

export function registerSwipe(program: Command): void {
  addConnectionFlags(
    program
      .command('swipe')
      .description(
        'swipe in a direction within an element (or the viewport) via ' +
          "WebdriverIO's cross-platform swipe (a real W3C pointer gesture), " +
          'naming the target with --selector, --label, or a raw --element id',
      ),
  )
    .option(
      '--selector <wdio-selector>',
      'WDIO selector for the element to swipe within, e.g. "accessibility id:foo", "xpath://..."',
    )
    .option(
      '-l, --label <text>',
      'accessibility id (label) of the element to swipe within; uses the first match',
    )
    .option('-e, --element <id>', 'raw element id to swipe within')
    .option('-d, --direction <dir>', 'up|down|left|right (default up)', (v) => {
      if (v !== 'up' && v !== 'down' && v !== 'left' && v !== 'right') {
        throw new Error(`--direction must be up|down|left|right (got "${v}")`);
      }
      return v;
    })
    .option('--duration <ms>', 'how long the swipe takes (default 1500)', (v) =>
      finiteNumber('--duration', v),
    )
    .option(
      '--percent <0..1>',
      'fraction of the element/viewport to traverse (default 0.95)',
      (v) => finiteNumber('--percent', v),
    )
    .option(
      '--from <x,y>',
      'absolute start coordinates (ignored when an element is given)',
      (v) => point('--from', v),
    )
    .option(
      '--to <x,y>',
      'absolute end coordinates (ignored when an element is given)',
      (v) => point('--to', v),
    )
    .action(async (opts) => {
      const sources = [opts.selector, opts.label, opts.element].filter(
        (s) => s != null,
      );
      if (sources.length > 1) {
        throw new Error('pass at most one of --selector, --label, --element');
      }
      const hasElementSource = sources.length === 1;
      const hasFrom = opts.from != null;
      const hasTo = opts.to != null;

      if (hasFrom !== hasTo) {
        throw new Error('pass both --from and --to, or neither');
      }
      if (hasElementSource && (hasFrom || hasTo)) {
        throw new Error(
          '--from/--to are ignored when an element is given; pass one or the other',
        );
      }

      await runWithSession(opts, async (b) => {
        const scrollableElement = hasElementSource
          ? opts.element != null
            ? await b.$({ [W3C_ELEMENT_ID]: opts.element })
            : await b.$(
                opts.label != null
                  ? `accessibility id:${opts.label}`
                  : (opts.selector as string),
              )
          : undefined;

        // Forward only the options the user set; WDIO owns the defaults
        // (direction: 'up', duration: 1500, percent: 0.95).
        await b.swipe({
          ...(opts.direction ? { direction: opts.direction as Direction } : {}),
          ...(opts.duration != null ? { duration: opts.duration } : {}),
          ...(opts.percent != null ? { percent: opts.percent } : {}),
          ...(scrollableElement ? { scrollableElement } : {}),
          ...(opts.from ? { from: opts.from } : {}),
          ...(opts.to ? { to: opts.to } : {}),
        });
      });
      process.stdout.write('ok\n');
    });
}
