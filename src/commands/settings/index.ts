import type { Command } from '@commander-js/extra-typings';
import { registerSettingsGet } from './get.js';
import { registerSettingsSet } from './set.js';

export function registerSettings(program: Command): void {
  const settings = program
    .command('settings')
    .description('read / update the live Appium driver settings API');
  registerSettingsGet(settings);
  registerSettingsSet(settings);
}
