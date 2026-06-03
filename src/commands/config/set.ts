import type { Command } from '@commander-js/extra-typings';

export function registerConfigSet(config: Command): void {
  config
    .command('set')
    .description('set a configuration value')
    .argument('<key>', 'configuration key')
    .argument('<value>', 'value to assign')
    .action(async (key, value) => {
      console.log('aco config set', { key, value });
    });
}
