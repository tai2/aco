import { acoOk } from './aco.js';

export function findId(value: string, using = 'accessibility id'): string {
  const r = acoOk(['element', 'find', '--using', using, '--value', value]);
  // `element find` writes the bare element id as JSON (find.ts).
  return JSON.parse(r.stdout.trim()) as string;
}

export function elementText(id: string): string {
  // `element text` writes `${text}\n` (text.ts:18).
  return acoOk(['element', 'text', '--element', id]).stdout.replace(/\n$/, '');
}

export function elementAttribute(id: string, name: string): unknown {
  // `element attribute` writes the value as JSON (attribute.ts).
  const r = acoOk(['element', 'attribute', '--element', id, '--name', name]);
  return JSON.parse(r.stdout.trim());
}
