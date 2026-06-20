import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { type SelectReturnType, select } from 'xpath';
import { AcoUserError } from './errors.js';

export function applyXpath(xml: string, expr: string): string {
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

  let result: SelectReturnType;
  try {
    result = select(expr, doc as unknown as Parameters<typeof select>[1]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AcoUserError(`invalid XPath expression: ${msg}`);
  }

  if (Array.isArray(result)) {
    const serializer = new XMLSerializer();
    return result
      .map((node) =>
        serializer.serializeToString(
          node as unknown as Parameters<XMLSerializer['serializeToString']>[0],
        ),
      )
      .join('\n');
  }
  return String(result);
}
