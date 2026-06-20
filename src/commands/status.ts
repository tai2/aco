import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags, resolveConnection } from '../lib/connection.js';

export function registerStatus(program: Command): void {
  addConnectionFlags(
    program
      .command('status')
      .description(
        'print the Appium server status (GET /status; no session required)',
      ),
  ).action(async (opts) => {
    const { conn } = resolveConnection(opts);
    const base = conn.basePath === '/' ? '' : conn.basePath.replace(/\/$/, '');
    const url = `${conn.protocol}://${conn.hostname}:${conn.port}${base}/status`;
    const res = await fetch(url);
    process.stdout.write(`${await res.text()}\n`);
  });
}
