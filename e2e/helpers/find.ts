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

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function elementRect(id: string): ElementRect {
  // `element rect` writes {x,y,width,height} as JSON (rect.ts) -- the W3C
  // GET /element/:id/rect, so the shape is identical on both drivers.
  const r = acoOk(['element', 'rect', '--element', id]);
  return JSON.parse(r.stdout.trim()) as ElementRect;
}
