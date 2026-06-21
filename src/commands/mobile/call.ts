import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerMobileCall(mobile: Command): void {
  addConnectionFlags(
    mobile
      .command('call')
      .description(
        'invoke any mobile: extension by name with a JSON args blob ' +
          '(unvalidated escape hatch; prefer `aco ios`/`aco android` for ' +
          'first-class commands)',
      ),
  )
    .requiredOption(
      '-n, --name <mobile:xxx>',
      'the mobile: command, including the "mobile: " prefix',
    )
    .option('-a, --args <json>', 'arguments object as JSON', '{}')
    .action(async (opts) => {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(opts.args) as Record<string, unknown>;
      } catch (err) {
        throw new Error(`--args must be valid JSON: ${(err as Error).message}`);
      }
      const result = await runWithSession(opts, (b) =>
        b.execute(opts.name, args),
      );
      process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
    });
}
