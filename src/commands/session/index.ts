import type { Command } from '@commander-js/extra-typings';
import { registerSessionStart } from './start.js';
import { registerSessionList } from './list.js';
import { registerSessionStop } from './stop.js';

export function registerSession(program: Command): void {
  const session = program
    .command('session')
    .description('manage Appium sessions (boot a server + create a session)');
  registerSessionStart(session);
  registerSessionList(session);
  registerSessionStop(session);
}
