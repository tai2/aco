import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../../lib/connection.js';
import { runWithSession } from '../../lib/run-with-session.js';

const W3C_ELEMENT_ID = 'element-6066-11e4-a52e-4f735466cecf';

const STRATEGIES = [
  'accessibility id',
  'xpath',
  'class name',
  'css selector',
  '-ios predicate string',
  '-ios class chain',
  '-android uiautomator',
  '-android viewtag',
  'id',
] as const;

function unwrapElementId(ref: Record<string, string>): string {
  // The raw W3C findElement command resolves to a `{ error, message }` value
  // on no-match rather than rejecting, so surface it as a real failure
  // instead of JSON-stringifying the error object as if it were an id.
  if (ref && typeof ref === 'object' && 'error' in ref) {
    throw new Error(ref.message || ref.error || 'no such element');
  }
  return ref[W3C_ELEMENT_ID] ?? ref.ELEMENT ?? JSON.stringify(ref);
}

export function registerElementFind(element: Command): void {
  addConnectionFlags(
    element
      .command('find')
      .description('find a single element (POST /element)'),
  )
    .requiredOption(
      '-u, --using <strategy>',
      `locator strategy (${STRATEGIES.join(', ')})`,
    )
    .requiredOption('-v, --value <value>', 'locator value')
    .option('--all', 'find all matching elements (POST /elements)')
    .action(async (opts) => {
      const result = await runWithSession(opts, async (b) => {
        if (opts.all) {
          const els = (await b.findElements(opts.using, opts.value)) as Record<
            string,
            string
          >[];
          return els.map(unwrapElementId);
        }
        const el = (await b.findElement(opts.using, opts.value)) as Record<
          string,
          string
        >;
        return unwrapElementId(el);
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
    });
}
