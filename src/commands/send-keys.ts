import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';
import {
  addTargetFlags,
  countTargetSources,
  resolveTargetElementId,
} from '../lib/target.js';

export function registerSendKeys(program: Command): void {
  addTargetFlags(
    addConnectionFlags(
      program
        .command('send-keys')
        .description(
          'type text into an element resolved by a WDIO selector ' +
            '(POST /element/:id/value). Clears the field first by default ' +
            '(POST /element/:id/clear); pass --no-clear to append instead',
        ),
    ),
    'target',
  )
    .requiredOption('-t, --text <value>', 'text to type')
    .option(
      '--no-clear',
      'skip clearing the field first (append to existing contents)',
    )
    .action(async (opts) => {
      if (countTargetSources(opts) !== 1) {
        throw new Error('pass exactly one of --selector, --label, --element');
      }

      await runWithSession(opts, async (b) => {
        const elementId = await resolveTargetElementId(b, opts);

        if (opts.clear) {
          await b.elementClear(elementId);
        }
        await b.elementSendKeys(elementId, opts.text);
      });
      process.stdout.write('ok\n');
    });
}
