import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerSendKeys(program: Command): void {
  addConnectionFlags(
    program
      .command('send-keys')
      .description(
        'type text into an element resolved by a WDIO selector ' +
          '(POST /element/:id/value). Clears the field first by default ' +
          '(POST /element/:id/clear); pass --no-clear to append instead',
      ),
  )
    .option(
      '--selector <wdio-selector>',
      'WDIO selector for the target, e.g. "accessibility id:foo", "xpath://..."',
    )
    .option(
      '-l, --label <text>',
      'accessibility id (label) of the target; types into the first match',
    )
    .option('-e, --element <id>', 'raw element id of the target')
    .requiredOption('-t, --text <value>', 'text to type')
    .option(
      '--no-clear',
      'skip clearing the field first (append to existing contents)',
    )
    .action(async (opts) => {
      const sources = [opts.selector, opts.label, opts.element].filter(
        (s) => s != null,
      );
      if (sources.length !== 1) {
        throw new Error('pass exactly one of --selector, --label, --element');
      }

      await runWithSession(opts, async (b) => {
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

        if (opts.clear) {
          await b.elementClear(elementId);
        }
        await b.elementSendKeys(elementId, opts.text);
      });
      process.stdout.write('ok\n');
    });
}
