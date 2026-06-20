import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { STRATEGIES, unwrapElementId } from '../lib/locator.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerWait(program: Command): void {
  addConnectionFlags(
    program
      .command('wait')
      .description('poll for an element until it reaches a state or times out'),
  )
    .requiredOption(
      '-u, --using <strategy>',
      `locator strategy (${STRATEGIES.join(', ')})`,
    )
    .requiredOption('-v, --value <value>', 'locator value')
    .option('--for <state>', 'displayed | enabled | exists', 'displayed')
    .option(
      '--timeout <ms>',
      'overall timeout',
      (v) => Number.parseInt(v, 10),
      10000,
    )
    .option(
      '--interval <ms>',
      'poll interval',
      (v) => Number.parseInt(v, 10),
      250,
    )
    .action(async (opts) => {
      await runWithSession(opts, async (b) => {
        const deadline = Date.now() + opts.timeout;
        let lastErr = '';
        while (Date.now() < deadline) {
          try {
            const el = (await b.findElement(opts.using, opts.value)) as Record<
              string,
              string
            >;
            if (!('error' in el)) {
              const id = unwrapElementId(el);
              const ok =
                opts.for === 'exists'
                  ? true
                  : opts.for === 'enabled'
                    ? await b.isElementEnabled(id)
                    : await b.isElementDisplayed(id);
              if (ok) {
                process.stdout.write(`${JSON.stringify(id)}\n`);
                return;
              }
            }
          } catch (e) {
            lastErr = (e as Error).message;
          }
          await new Promise((r) => setTimeout(r, opts.interval));
        }
        throw new Error(
          `wait timed out after ${opts.timeout}ms (${opts.for}); last: ${lastErr}`,
        );
      });
    });
}
