import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Run the BUILT cli -- `session start --detach` refuses to run under tsx
// (start.ts:77-84), so the e2e suite always drives dist/cli.js.
export const cliEntry = resolve(here, '..', '..', 'dist', 'cli.js');

export interface AcoResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runAco(args: string[], env?: NodeJS.ProcessEnv): AcoResult {
  const r = spawnSync('node', [cliEntry, ...args], {
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
    // A cold find can take a couple of seconds; most calls are fast.
    timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export function acoOk(args: string[]): AcoResult {
  const r = runAco(args);
  if (r.status !== 0) {
    throw new Error(
      `aco ${args.join(' ')} exited ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    );
  }
  return r;
}
