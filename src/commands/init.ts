import type { Command } from '@commander-js/extra-typings';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('initialise a new aco project in the current directory')
    .option('-f, --force', 'overwrite existing files')
    .action(async (opts) => {
      console.log('aco init', { force: opts.force ?? false });
    });
}
