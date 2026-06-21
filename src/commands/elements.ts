import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { formatRows, listElements } from '../lib/list-elements.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerElements(program: Command): void {
  addConnectionFlags(
    program
      .command('elements')
      .description(
        'list on-screen elements that carry text (name/label/value or ' +
          'content-desc/text), each with a ready-to-paste selector for `aco tap`',
      ),
  )
    .option('--json', 'emit machine-readable rows instead of the human list')
    .option('--limit <n>', 'cap the number of rows', (v) => {
      const n = Number.parseInt(v, 10);
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`--limit must be a non-negative integer (got "${v}")`);
      }
      return n;
    })
    .action(async (opts) => {
      const rows = await runWithSession(opts, async (b, platform) => {
        const xml = await b.getPageSource();
        return listElements(xml, platform, { limit: opts.limit });
      });
      const out = opts.json ? JSON.stringify(rows, null, 2) : formatRows(rows);
      process.stdout.write(`${out}\n`);
    });
}
