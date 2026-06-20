import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';
import { applyXpath } from '../lib/xpath.js';

export function registerSource(program: Command): void {
  addConnectionFlags(
    program
      .command('source')
      .description('print the current page source (W3C GET /source)'),
  )
    .option(
      '-x, --xpath <expr>',
      'filter the page source with a client-side XPath 1.0 expression ' +
        '(evaluated locally against the returned XML, not by the driver)',
    )
    .action(async (opts) => {
      const xml = await runWithSession(opts, (b) => b.getPageSource());
      const out = opts.xpath ? applyXpath(xml, opts.xpath) : xml;
      process.stdout.write(`${out}\n`);
    });
}
