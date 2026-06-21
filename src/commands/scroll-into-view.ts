import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';
import {
  addTargetFlags,
  countTargetSources,
  resolveTargetElement,
} from '../lib/target.js';

type Direction = 'up' | 'down' | 'left' | 'right';

function finiteNumber(flag: string, v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`${flag} must be a number (got "${v}")`);
  }
  return n;
}

function integer(flag: string, v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`${flag} must be an integer (got "${v}")`);
  }
  return n;
}

export function registerScrollIntoView(program: Command): void {
  addTargetFlags(
    addConnectionFlags(
      program
        .command('scroll-into-view')
        .description(
          "scroll a native element into view (WebdriverIO's element.scrollIntoView; " +
            'swipes until the element is displayed), naming the target with ' +
            '--selector, --label, or a raw --element id',
        ),
    ),
    'element to bring on screen',
  )
    .option('-d, --direction <dir>', 'up|down|left|right (default up)', (v) => {
      if (v !== 'up' && v !== 'down' && v !== 'left' && v !== 'right') {
        throw new Error(`--direction must be up|down|left|right (got "${v}")`);
      }
      return v;
    })
    .option(
      '--max-scrolls <n>',
      'max swipes before giving up (default 10)',
      (v) => integer('--max-scrolls', v),
    )
    .option(
      '--duration <ms>',
      'duration of each swipe in ms (default 1500)',
      (v) => finiteNumber('--duration', v),
    )
    .option(
      '--percent <0..1>',
      'fraction of the scrollable element to swipe (default 0.95)',
      (v) => finiteNumber('--percent', v),
    )
    .option(
      '--scrollable <wdio-selector>',
      'WDIO selector for the scrollable container ' +
        '(defaults to the platform default scroll view)',
    )
    .action(async (opts) => {
      if (countTargetSources(opts) !== 1) {
        throw new Error('pass exactly one of --selector, --label, --element');
      }

      const dir = opts.direction as Direction | undefined;

      await runWithSession(opts, async (b) => {
        const target = await resolveTargetElement(b, opts);

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
