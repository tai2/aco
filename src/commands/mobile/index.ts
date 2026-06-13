import type { Command } from '@commander-js/extra-typings';
import { registerMobileList } from './list.js';
import { registerMobileCall } from './call.js';

export function registerMobile(program: Command): void {
  const mobile = program
    .command('mobile')
    .description('inspect and call mobile: execute extensions');
  registerMobileList(mobile);
  registerMobileCall(mobile);
}
