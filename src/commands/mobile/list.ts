import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags, resolveConnection } from '../../lib/connection.js';

export function registerMobileList(mobile: Command): void {
  addConnectionFlags(
    mobile
      .command('list')
      .description(
        'list mobile: extensions the connected driver advertises ' +
          '(GET /session/:id/appium/extensions)',
      ),
  )
    .option('--json', 'emit the raw endpoint payload as JSON')
    .action(async (opts) => {
      const { conn } = resolveConnection(opts);
      const base =
        conn.basePath === '/' ? '' : conn.basePath.replace(/\/$/, '');
      const url =
        `${conn.protocol}://${conn.hostname}:${conn.port}` +
        `${base}/session/${conn.sessionId}/appium/extensions`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `listExtensions failed: ${res.status} ${res.statusText}`,
        );
      }
      const body = (await res.json()) as {
        value?: { rest?: { driver?: Record<string, unknown> } };
      };
      const driver = body.value?.rest?.driver ?? {};

      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify(body.value ?? body, null, 2)}\n`,
        );
        return;
      }
      for (const name of Object.keys(driver)) {
        process.stdout.write(`${name}\n`);
      }
    });
}
