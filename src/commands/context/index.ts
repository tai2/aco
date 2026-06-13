import type { Command } from '@commander-js/extra-typings';
import { registerContextCurrent } from './current.js';
import { registerContextList } from './list.js';
import { registerContextSwitch } from './switch.js';

export function registerContext(program: Command): void {
  const context = program
    .command('context')
    .description('inspect / switch the active automation context');
  registerContextList(context);
  registerContextCurrent(context);
  registerContextSwitch(context);
}
