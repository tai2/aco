import type { Command } from '@commander-js/extra-typings';
import { registerDeviceList } from './list.js';

export function registerDevice(program: Command): void {
  const device = program
    .command('device')
    .description('discover iOS Simulators and Android AVDs to target');
  registerDeviceList(device);
}
