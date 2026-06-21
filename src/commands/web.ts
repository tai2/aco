import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import { runWithSession } from '../lib/run-with-session.js';

export function registerWeb(program: Command): void {
  const web = program
    .command('web')
    .description(
      'navigate the active web/WebView context ' +
        '(switch into a WEBVIEW_* context first via `aco context switch`)',
    );

  addConnectionFlags(
    web
      .command('url')
      .description(
        'get or set the current URL. With <url>: navigate; ' +
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

  for (const [name, method, desc] of [
    ['back', 'back', 'navigate back in history'],
    ['forward', 'forward', 'navigate forward in history'],
    ['refresh', 'refresh', 'reload the current page'],
  ] as const) {
    addConnectionFlags(web.command(name).description(desc)).action(
      async (opts) => {
        await runWithSession(opts, (b) => b[method]());
        process.stdout.write('ok\n');
      },
    );
  }
}
