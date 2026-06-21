import type { Command } from '@commander-js/extra-typings';
import { buildTap } from '../lib/actions.js';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

function finiteNumber(flag: string, v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`${flag} must be a number (got "${v}")`);
  }
  return n;
}

export function registerTap(program: Command): void {
  addConnectionFlags(
    program
      .command('tap')
      .description(
        'tap the center of an element (or absolute coords) with a real ' +
          'W3C pointer gesture (POST /actions), so the touch bubbles up the ' +
          'native view hierarchy',
      ),
  )
    .option(
      '--selector <wdio-selector>',
      'WDIO selector for the target, e.g. "accessibility id:foo", "xpath://..."',
    )
    .option(
      '-l, --label <text>',
      'accessibility id (label) of the target; taps the first match',
    )
    .option('-e, --element <id>', 'raw element id of the target')
    .option(
      '-x, --x <px>',
      'x coordinate (absolute, or offset within element)',
      (v) => finiteNumber('--x', v),
    )
    .option(
      '-y, --y <px>',
      'y coordinate (absolute, or offset within element)',
      (v) => finiteNumber('--y', v),
    )
    .option(
      '-d, --duration <ms>',
      'how long the finger stays down (default 100)',
      (v) => finiteNumber('--duration', v),
    )
    .action(async (opts) => {
      const sources = [opts.selector, opts.label, opts.element].filter(
        (s) => s != null,
      );
      if (sources.length > 1) {
        throw new Error('pass at most one of --selector, --label, --element');
      }
      const hasElementSource = sources.length === 1;
      const hasCoords = opts.x != null && opts.y != null;

      if (!hasElementSource && !hasCoords) {
        throw new Error(
          'nothing to tap: pass --selector, --label, --element, or both --x and --y',
        );
      }

      await runWithSession(opts, async (b) => {
        let x: number;
        let y: number;

        if (hasElementSource) {
          let elementId: string;
          if (opts.element != null) {
            elementId = opts.element;
          } else {
            const selector =
              opts.label != null
                ? `accessibility id:${opts.label}`
                : (opts.selector as string);
            const el = await b.$(selector);
            elementId = await el.elementId;
            if (!elementId) {
              throw new Error(`no element matched ${selector}`);
            }
          }
          const rect = await b.getElementRect(elementId);
          // --x/--y act as an offset from the element's top-left when an
          // element is given; otherwise tap its geometric center.
          x = opts.x != null ? rect.x + opts.x : rect.x + rect.width / 2;
          y = opts.y != null ? rect.y + opts.y : rect.y + rect.height / 2;
        } else {
          // Absolute viewport coordinates (both guaranteed present here).
          x = opts.x as number;
          y = opts.y as number;
        }

        await b.performActions(
          buildTap(x, y, opts.duration) as Parameters<
            typeof b.performActions
          >[0],
        );
        await b.releaseActions();
      });
      process.stdout.write('ok\n');
    });
}
