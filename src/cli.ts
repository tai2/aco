import { Command } from '@commander-js/extra-typings';
import { assertSupportedNodeVersion } from './lib/node-version.js';
import { registerInit } from './commands/init.js';
import { registerConfig } from './commands/config/index.js';

assertSupportedNodeVersion('20.0.0');

const program = new Command()
  .name('aco')
  .description('aco — TypeScript CLI scaffold (subcommand-capable).')
  .version('0.0.0')
  .showHelpAfterError();

registerInit(program);
registerConfig(program);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`aco: ${message}`);
  process.exit(1);
}
