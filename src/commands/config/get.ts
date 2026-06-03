import type { Command } from '@commander-js/extra-typings';

export function registerConfigGet(config: Command): void {
  config
    .command('get')
    .description('read a configuration value')
    .argument('<key>', 'configuration key')
    .action(async (key) => {
      console.log('aco config get', { key });
    });
}
