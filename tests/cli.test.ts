import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = resolve(here, '..', 'src', 'cli.ts');

function runCli(args: string[]) {
  return spawnSync('npx', ['--no-install', 'tsx', cliEntry, ...args], {
    encoding: 'utf8',
  });
}

describe('aco CLI scaffold', () => {
  it('prints help when invoked with --help', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('aco');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('config');
  });

  it('routes to the init subcommand', () => {
    const result = runCli(['init']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('aco init');
  });

  it('routes to the nested config set subcommand', () => {
    const result = runCli(['config', 'set', 'foo', 'bar']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('aco config set');
    expect(result.stdout).toContain('foo');
    expect(result.stdout).toContain('bar');
  });
});
