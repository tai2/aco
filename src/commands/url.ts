import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerUrl(program: Command): void {
  addConnectionFlags(
    program
      .command('url')
      .description(
        'get or set the current URL (web context). With <url>: navigate; ' +
          'without: print the current URL',
      ),
  )
    .argument('[url]', 'URL to navigate to (omit to read the current URL)')
    .action(async (url, opts) => {
      if (url) {
        await runWithSession(opts, (b) => b.navigateTo(url));
        process.stdout.write('ok\n');
      } else {
        const current = await runWithSession(opts, (b) => b.getUrl());
        process.stdout.write(`${current}\n`);
      }
    });
}
