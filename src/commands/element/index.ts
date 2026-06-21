import type { Command } from '@commander-js/extra-typings';
import { registerElementActive } from './active.js';
import { registerElementAttribute } from './attribute.js';
import { registerElementClear } from './clear.js';
import { registerElementClick } from './click.js';
import { registerElementDisplayed } from './displayed.js';
import { registerElementEnabled } from './enabled.js';
import { registerElementFind } from './find.js';
import { registerElementProperty } from './property.js';
import { registerElementRect } from './rect.js';
import { registerElementSelected } from './selected.js';
import { registerElementSendKeys } from './send-keys.js';
import { registerElementText } from './text.js';

export function registerElement(program: Command): void {
  const element = program
    .command('element')
    .description('W3C element commands');
  registerElementFind(element);
  registerElementActive(element);
  registerElementClick(element);
  registerElementText(element);
  registerElementSendKeys(element);
  registerElementAttribute(element);
  registerElementProperty(element);
  registerElementDisplayed(element);
  registerElementEnabled(element);
  registerElementSelected(element);
  registerElementRect(element);
  registerElementClear(element);
}
