import { writeFileSync } from 'node:fs';
import type { Command } from '@commander-js/extra-typings';
import { runWithSession } from '../lib/run-with-session.js';
import { addConnectionFlags } from '../lib/connection.js';

export function registerScreenshot(program: Command): void {
  addConnectionFlags(
    program
      .command('screenshot')
      .description('take a viewport screenshot (W3C GET /screenshot)'),
  )
    .option('-o, --out <path>', 'write PNG here (default: stdout as base64)')
    .action(async (opts) => {
      const b64 = await runWithSession(opts, (b) => b.takeScreenshot());
      if (opts.out) {
        writeFileSync(opts.out, Buffer.from(b64, 'base64'));
        process.stdout.write(`saved screenshot to ${opts.out}\n`);
      } else {
        process.stdout.write(b64);
      }
    });
}
