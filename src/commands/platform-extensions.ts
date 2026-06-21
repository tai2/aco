import type { Command } from '@commander-js/extra-typings';
import { addConnectionFlags } from '../lib/connection.js';
import {
  type ExtensionSpec,
  type ParamKind,
  loadManifest,
} from '../lib/manifest.js';
import { runWithSession } from '../lib/run-with-session.js';

type Platform = 'ios' | 'android';

// "mobile: doubleTap" -> "double-tap"
function subcommandName(mobileName: string): string {
  return mobileName
    .replace(/^mobile:\s*/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

// Coerce a raw CLI string using the param's source-derived kind.
function coerceArg(value: string, kind: ParamKind): unknown {
  switch (kind) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    default:
      // 'string' -- also the fallback for types we cannot reduce
      // (element IDs, unions, arrays/objects): forwarded as a raw string.
      return value;
  }
}

function registerOneExtension(
  group: Command,
  mobileName: string,
  spec: ExtensionSpec,
): void {
  const cmd = group
    .command(subcommandName(mobileName))
    .description(`${mobileName} (${spec.command})`);

  for (const p of spec.params) {
    const flag = `--${p.name} <value>`;
    const help = `${p.required ? 'required' : 'optional'} param "${p.name}" (${p.kind})`;
    if (p.required) cmd.requiredOption(flag, help);
    else cmd.option(flag, help);
  }

  addConnectionFlags(cmd).action(async (opts: Record<string, unknown>) => {
    const args: Record<string, unknown> = {};
    for (const p of spec.params) {
      const raw = opts[p.name];
      if (typeof raw === 'string') args[p.name] = coerceArg(raw, p.kind);
    }
    const result = await runWithSession(
      opts as Parameters<typeof runWithSession>[0],
      (b) => b.execute(mobileName, args),
    );
    process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
  });
}

function registerPlatformExtensions(
  program: Command,
  platform: Platform,
): void {
  const group = program
    .command(platform)
    .description(
      `${platform === 'ios' ? 'iOS (XCUITest)' : 'Android (UiAutomator2)'} mobile: extensions as first-class commands (generated from the pinned driver source)`,
    );
  for (const [mobileName, spec] of Object.entries(loadManifest(platform))) {
    registerOneExtension(group, mobileName, spec);
  }
}

export function registerIos(program: Command): void {
  registerPlatformExtensions(program, 'ios');
}

export function registerAndroid(program: Command): void {
  registerPlatformExtensions(program, 'android');
}
