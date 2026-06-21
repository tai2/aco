import { DOMParser } from '@xmldom/xmldom';
import type { Platform } from './connection.js';
import { AcoUserError } from './errors.js';

export interface ElementRow {
  index: number;
  type: string;
  label: string;
  accessibilityId?: string;
  value?: string;
  selector: string;
  rect?: { x: number; y: number; width: number; height: number };
}

const ATTRS = {
  ios: { a11y: 'name', text: 'label', value: 'value' },
  android: { a11y: 'content-desc', text: 'text', value: 'text' },
} as const;

function esc(s: string): string {
  return s.replace(/"/g, '\\"');
}

function attr(el: Element, name: string): string {
  return el.getAttribute(name)?.trim() ?? '';
}

function rectOf(
  platform: Platform,
  el: Element,
): ElementRow['rect'] | undefined {
  if (platform === 'ios') {
    const n = (k: string) => Number.parseFloat(el.getAttribute(k) ?? '');
    const x = n('x');
    const y = n('y');
    const width = n('width');
    const height = n('height');
    if ([x, y, width, height].every(Number.isFinite)) {
      return { x, y, width, height };
    }
    return undefined;
  }
  const m = (el.getAttribute('bounds') ?? '').match(
    /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/,
  );
  if (!m) return undefined;
  const x1 = Number(m[1]);
  const y1 = Number(m[2]);
  const x2 = Number(m[3]);
  const y2 = Number(m[4]);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function selectorFor(
  platform: Platform,
  a11y: string,
  text: string,
): string | undefined {
  if (a11y) return `accessibility id:${a11y}`;
  if (text) {
    return platform === 'ios'
      ? `-ios predicate string:label == "${esc(text)}"`
      : `-android uiautomator:new UiSelector().text("${esc(text)}")`;
  }
  return undefined;
}

export function listElements(
  xml: string,
  platform: Platform,
  opts: { limit?: number } = {},
): ElementRow[] {
  const parseErrors: string[] = [];
  let doc: ReturnType<DOMParser['parseFromString']>;
  try {
    doc = new DOMParser({
      onError: (level, msg) => {
        if (level === 'error' || level === 'fatalError') parseErrors.push(msg);
      },
    }).parseFromString(xml, 'text/xml');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AcoUserError(`could not parse page source as XML: ${msg}`);
  }
  if (parseErrors.length > 0) {
    throw new AcoUserError(
      `could not parse page source as XML: ${parseErrors[0]}`,
    );
  }

  const a = ATTRS[platform];
  const rows: ElementRow[] = [];

  const walk = (node: Element) => {
    const tag = node.tagName ?? node.nodeName;

    const a11y = attr(node, a.a11y);
    const text = attr(node, a.text);
    const value = a.value !== a.text ? attr(node, a.value) : '';

    const selector = selectorFor(platform, a11y, text || value);
    if (selector) {
      rows.push({
        index: rows.length,
        type: tag,
        label: text || a11y || value,
        accessibilityId: a11y || undefined,
        value: value || undefined,
        selector,
        rect: rectOf(platform, node),
      });
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child?.nodeType === 1) walk(child as unknown as Element);
    }
  };

  const root = doc.documentElement;
  if (root) walk(root as unknown as Element);

  return opts.limit != null ? rows.slice(0, opts.limit) : rows;
}

export function formatRows(rows: ElementRow[]): string {
  if (rows.length === 0) {
    return 'no labelled elements found on the current screen';
  }
  return rows
    .map((r) => {
      const rect = r.rect
        ? `\n      rect: ${r.rect.x},${r.rect.y} ${r.rect.width}x${r.rect.height}`
        : '';
      return (
        `#${r.index}  ${r.type}  ${JSON.stringify(r.label)}\n` +
        `      selector: ${r.selector}${rect}`
      );
    })
    .join('\n');
}
