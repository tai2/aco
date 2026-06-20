import type { Command } from '@commander-js/extra-typings';
import {
  asRawActions,
  buildActions,
  parsePointerType,
} from '../lib/actions.js';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerActions(program: Command): void {
  addConnectionFlags(
    program
      .command('actions')
      .description(
        'perform a low-level W3C pointer gesture (POST /actions); ' +
          'cross-platform, no mobile: extension needed',
      ),
  )
    .option(
      '-g, --gesture <steps>',
      'one pointer chain, e.g. "move 200 600 0, down, move 200 200 300, up"; ' +
        'repeat for parallel multi-touch chains',
      (val: string, prev: string[] = []) => [...prev, val],
      [] as string[],
    )
    .option(
      '-t, --type <text>',
      'type these letters via a key source; combinable with --gesture',
    )
    .option(
      '-j, --json <w3c-actions>',
      'raw W3C actions array (escape hatch; mutually exclusive with --gesture/--type)',
    )
    .option(
      '--pointer-type <touch|mouse|pen>',
      'pointer device type (default: touch)',
      parsePointerType,
      'touch' as const,
    )
    .option(
      '--no-release',
      'skip the trailing DELETE /actions (leaves input state held)',
    )
    .option(
      '--release-only',
      'issue a standalone DELETE /actions and nothing else ' +
        '(cleanup after a prior --no-release); mutually exclusive with ' +
        '--gesture/--type/--json/--no-release',
    )
    .action(async (opts) => {
      const gestures = opts.gesture ?? [];
      const hasErgonomic = gestures.length > 0 || opts.type != null;

      if (opts.releaseOnly) {
        if (hasErgonomic || opts.json) {
          throw new Error('--release-only takes no --gesture/--type/--json');
        }
        if (opts.release === false) {
          throw new Error('--release-only and --no-release contradict');
        }
        await runWithSession(opts, async (b) => {
          await b.releaseActions();
        });
        process.stdout.write('ok\n');
        return;
      }

      if (hasErgonomic && opts.json) {
        throw new Error('pass either --gesture/--type or --json, not both');
      }

      let payload: unknown[];
      if (opts.json) {
        let raw: unknown;
        try {
          raw = JSON.parse(opts.json);
        } catch (err) {
          throw new Error(
            `--json must be valid JSON: ${(err as Error).message}`,
          );
        }
        payload = asRawActions(raw);
      } else if (hasErgonomic) {
        payload = buildActions(gestures, opts.pointerType, opts.type);
      } else {
        throw new Error('nothing to do: pass --gesture, --type, or --json');
      }

      await runWithSession(opts, async (b) => {
        await b.performActions(
          payload as Parameters<typeof b.performActions>[0],
        );
        if (opts.release !== false) {
          await b.releaseActions();
        }
      });
      process.stdout.write('ok\n');
    });
}
