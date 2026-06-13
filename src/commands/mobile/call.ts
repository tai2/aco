import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { AcoUnknownMobileExtensionError } from '../../lib/errors.js';
import { loadMethodMap } from '../../lib/method-map.js';
import { runWithSession } from '../../lib/run-with-session.js';

export function registerMobileCall(mobile: Command): void {
  addConnectionFlags(
    mobile
      .command('call')
      .description('invoke a mobile: extension by name with a JSON args blob'),
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

      const result = await runWithSession(opts, async (b, platform) => {
        const map = loadMethodMap(platform);
        const spec = map[opts.name];
        if (!spec) {
          throw new AcoUnknownMobileExtensionError(opts.name, platform);
        }
        for (const k of spec.params?.required ?? []) {
          if (!(k in args))
            throw new Error(`"${opts.name}" requires param "${k}"`);
        }
        const known = new Set([
          ...(spec.params?.required ?? []),
          ...(spec.params?.optional ?? []),
        ]);
        for (const k of Object.keys(args)) {
          if (!known.has(k)) {
            console.error(
              `aco: warning -- "${k}" is not in the pinned schema for ${opts.name}`,
            );
          }
        }
        return b.execute(opts.name, args);
      });
      process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
    });
}
