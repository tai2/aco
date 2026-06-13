import { Command } from '@commander-js/extra-typings';
import { registerContext } from './commands/context/index.js';
import { registerDevice } from './commands/device/index.js';
import { registerElement } from './commands/element/index.js';
import { registerMobile } from './commands/mobile/index.js';
import { registerScreenshot } from './commands/screenshot.js';
import { registerSession } from './commands/session/index.js';
import { registerSource } from './commands/source.js';
import { registerSwipe } from './commands/swipe.js';
import { registerTap } from './commands/tap.js';
import { assertSupportedNodeVersion } from './lib/node-version.js';

assertSupportedNodeVersion('20.0.0');

const program = new Command()
  .name('aco')
  .description(
    'Appium Command-line Operator -- start a session, then drive it from the shell.',
  )
  .version('0.0.0')
  .showHelpAfterError();

registerSession(program);

registerElement(program);
registerSource(program);
registerScreenshot(program);
registerTap(program);
registerSwipe(program);
registerContext(program);
registerMobile(program);
registerDevice(program);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`aco: ${message}`);
  process.exit(1);
}
