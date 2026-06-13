import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseConnection } from '../src/lib/connection.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = resolve(here, '..', 'src', 'cli.ts');

function runCli(args: string[]) {
  return spawnSync(
    'node',
    ['--import', 'tsx/esm', cliEntry, ...args],
    { encoding: 'utf8' },
  );
}

describe('aco CLI', () => {
  it('prints help when invoked with --help', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('aco');
    expect(result.stdout).toContain('session');
    expect(result.stdout).toContain('mobile');
  });

  it('lists mobile: extensions for ios from the bundled snapshot', () => {
    const result = runCli(['mobile', 'list', '--platform', 'ios', '--json']);
    expect(result.status).toBe(0);
    const map = JSON.parse(result.stdout) as Record<
      string,
      { command: string }
    >;
    expect(map['mobile: tap']).toBeDefined();
    expect(map['mobile: tap']?.command).toBe('mobileTap');
  });

  it('lists mobile: extensions for android (includes inherited android-driver entries)', () => {
    const result = runCli([
      'mobile',
      'list',
      '--platform',
      'android',
      '--json',
    ]);
    expect(result.status).toBe(0);
    const map = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(map['mobile: clickGesture']).toBeDefined();
    expect(map['mobile: shell']).toBeDefined();
  });

  it('shows the pinned driver versions the iOS snapshot was generated from', () => {
    const result = runCli([
      'mobile',
      'list',
      '--platform',
      'ios',
      '--versions',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /^appium-xcuitest-driver@\d+\.\d+\.\d+ \(\d+ entries\)\n$/,
    );
  });

  it('shows both uiautomator2 and android-driver versions for the android snapshot', () => {
    const result = runCli([
      'mobile',
      'list',
      '--platform',
      'android',
      '--versions',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/appium-uiautomator2-driver@\d+\.\d+\.\d+/);
    expect(result.stdout).toMatch(/appium-android-driver@\d+\.\d+\.\d+/);
  });

  it('emits the full snapshot envelope when --versions is combined with --json', () => {
    const result = runCli([
      'mobile',
      'list',
      '--platform',
      'ios',
      '--versions',
      '--json',
    ]);
    expect(result.status).toBe(0);
    const snapshot = JSON.parse(result.stdout) as {
      drivers: { package: string; version: string }[];
      methods: Record<string, unknown>;
    };
    expect(Array.isArray(snapshot.drivers)).toBe(true);
    expect(snapshot.drivers[0]).toMatchObject({
      package: 'appium-xcuitest-driver',
    });
    expect(typeof snapshot.drivers[0]?.version).toBe('string');
    expect(snapshot.methods['mobile: tap']).toBeDefined();
  });

  it('rejects a subcommand invocation that omits --session', () => {
    const result = runCli(['source', '--platform', 'ios']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/required option.*--session/);
  });

  it('rejects a subcommand invocation whose --server-url is not a valid URL', () => {
    const result = runCli([
      'source',
      '--session',
      'sid',
      '--server-url',
      'not a url',
      '--platform',
      'ios',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--server-url is not a valid URL/);
  });

  it('parses connection flags with the default server-url when --server-url is omitted', () => {
    const conn = parseConnection({ session: 'sid', platform: 'ios' });
    expect(conn.hostname).toBe('127.0.0.1');
    expect(conn.port).toBe(4723);
    expect(conn.protocol).toBe('http');
  });
});
