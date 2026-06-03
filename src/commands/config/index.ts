import type { Command } from '@commander-js/extra-typings';
import { registerConfigSet } from './set.js';
import { registerConfigGet } from './get.js';

export function registerConfig(program: Command): void {
  const config = program
    .command('config')
    .description('manage aco configuration');

  registerConfigSet(config);
  registerConfigGet(config);
}
