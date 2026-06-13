import type { Command } from '@commander-js/extra-typings';
import { registerElementAttribute } from './attribute.js';
import { registerElementClick } from './click.js';
import { registerElementFind } from './find.js';
import { registerElementSendKeys } from './send-keys.js';
import { registerElementText } from './text.js';

export function registerElement(program: Command): void {
  const element = program
    .command('element')
    .description('W3C element commands');
  registerElementFind(element);
  registerElementClick(element);
  registerElementText(element);
  registerElementSendKeys(element);
  registerElementAttribute(element);
}
