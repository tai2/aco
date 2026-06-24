import { Command } from '@commander-js/extra-typings';
import pkg from '../package.json' with { type: 'json' };
import { registerActions } from './commands/actions.js';
import { registerContext } from './commands/context/index.js';
import { registerDevice } from './commands/device/index.js';
import { registerElement } from './commands/element/index.js';
import { registerElements } from './commands/elements.js';
import { registerMobile } from './commands/mobile/index.js';
import { registerOrientation } from './commands/orientation.js';
import {
  registerAndroid,
  registerIos,
} from './commands/platform-extensions.js';
import { registerScreenshot } from './commands/screenshot.js';
import { registerScrollIntoView } from './commands/scroll-into-view.js';
import { registerSendKeys } from './commands/send-keys.js';
import { registerSession } from './commands/session/index.js';
import { registerSettings } from './commands/settings/index.js';
import { registerSource } from './commands/source.js';
import { registerStatus } from './commands/status.js';
import { registerSwipe } from './commands/swipe.js';
import { registerTap } from './commands/tap.js';
import { registerTimeouts } from './commands/timeouts.js';
import { registerWait } from './commands/wait.js';
import { registerWeb } from './commands/web.js';
import { registerWindow } from './commands/window.js';
import { assertSupportedNodeVersion } from './lib/node-version.js';

assertSupportedNodeVersion('20.0.0');

const program = new Command()
  .name('aco')
  .description(
    'Appium Command-line Operator -- start a session, then drive it from the shell.',
  )
  .version(pkg.version)
  .showHelpAfterError();

registerSession(program);

registerElement(program);
registerSource(program);
registerElements(program);
registerScreenshot(program);
registerTap(program);
registerSwipe(program);
registerSendKeys(program);
registerScrollIntoView(program);
registerActions(program);
registerContext(program);
registerMobile(program);
registerIos(program);
registerAndroid(program);
registerDevice(program);
registerSettings(program);
registerWeb(program);
registerOrientation(program);
registerTimeouts(program);
registerWindow(program);
registerStatus(program);
registerWait(program);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`aco: ${message}`);
  process.exit(1);
}
