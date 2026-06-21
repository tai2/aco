import type { Command, OptionValues } from '@commander-js/extra-typings';
import { W3C_ELEMENT_ID } from './locator.js';

export interface TargetFlags {
  selector?: string;
  label?: string;
  element?: string;
}

/**
 * Adds the `--selector`/`--label`/`--element` targeting trio shared by
 * `aco tap`, `aco swipe`, `aco send-keys`, and `aco scroll-into-view`. `noun`
 * describes the target in the help text (e.g. "target", "element to swipe
 * within"). The generic preserves the command's existing option types so the
 * trio composes with the connection flags already on the command.
 */
export function addTargetFlags<
  Args extends unknown[],
  Opts extends OptionValues,
>(cmd: Command<Args, Opts>, noun: string) {
  return cmd
    .option(
      '--selector <wdio-selector>',
      `WDIO selector for the ${noun}, e.g. "accessibility id:foo", "xpath://..."`,
    )
    .option(
      '-l, --label <text>',
      `accessibility id (label) of the ${noun}; uses the first match`,
    )
    .option('-e, --element <id>', `raw element id of the ${noun}`);
}

/** Number of element sources the user named (0, 1, or more). */
export function countTargetSources(opts: TargetFlags): number {
  return [opts.selector, opts.label, opts.element].filter((s) => s != null)
    .length;
}

/**
 * Resolve the trio to a WDIO element. A raw `--element` id is rehydrated via
 * the W3C element reference; otherwise WDIO re-resolves the selector lazily
 * (so callers like scrollIntoView/swipe can re-find it across a gesture).
 * Assumes the caller has validated that exactly one source is present.
 */
export function resolveTargetElement(
  b: WebdriverIO.Browser,
  opts: TargetFlags,
) {
  return opts.element != null
    ? b.$({ [W3C_ELEMENT_ID]: opts.element })
    : b.$(
        opts.label != null
          ? `accessibility id:${opts.label}`
          : (opts.selector as string),
      );
}

/**
 * Resolve the trio to a concrete element id, eagerly looking up a
 * selector/label match and failing loudly when nothing matches. For callers
 * (tap, send-keys) that need the id up front rather than a lazy element.
 */
export async function resolveTargetElementId(
  b: WebdriverIO.Browser,
  opts: TargetFlags,
): Promise<string> {
  if (opts.element != null) {
    return opts.element;
  }
  const selector =
    opts.label != null
      ? `accessibility id:${opts.label}`
      : (opts.selector as string);
  const el = await b.$(selector);
  const elementId = await el.elementId;
  if (!elementId) {
    throw new Error(`no element matched ${selector}`);
  }
  return elementId;
}
