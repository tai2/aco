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

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  // Most calls are fast (a cold find takes a couple of seconds); `session
  // start` is the exception -- a cold simulator/WDA boot can run for minutes,
  // so it overrides this to a value above its own --session-timeout.
  timeoutMs?: number;
}

export function runAco(args: string[], opts: RunOptions = {}): AcoResult {
  const r = spawnSync('node', [cliEntry, ...args], {
    encoding: 'utf8',
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    timeout: opts.timeoutMs ?? 60_000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export function acoOk(args: string[], opts: RunOptions = {}): AcoResult {
  const r = runAco(args, opts);
  if (r.status !== 0) {
    throw new Error(
      `aco ${args.join(' ')} exited ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    );
  }
  return r;
}
