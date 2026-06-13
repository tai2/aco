import type { Command } from '@commander-js/extra-typings';
import { registerMobileCall } from './call.js';
import { registerMobileList } from './list.js';

export function registerMobile(program: Command): void {
  const mobile = program
    .command('mobile')
    .description('inspect and call mobile: execute extensions');
  registerMobileList(mobile);
  registerMobileCall(mobile);
}
