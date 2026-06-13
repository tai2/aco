import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseConnection, resolveConnection } from '../src/lib/connection.js';
import type { SessionRecord } from '../src/lib/session-store.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = resolve(here, '..', 'src', 'cli.ts');

function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync('node', ['--import', 'tsx/esm', cliEntry, ...args], {
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });
}

function makeTmpHome(): string {
  return mkdtempSync(join(tmpdir(), 'aco-test-'));
}

function writeRecord(home: string, rec: SessionRecord): void {
  const dir = join(home, '.aco', 'sessions');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(dir, `${encodeURIComponent(rec.sessionId)}.json`),
    JSON.stringify(rec, null, 2) + '\n',
    { encoding: 'utf8', mode: 0o600 },
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

  it('rejects a subcommand invocation when no flags and no stored session exist', () => {
    const home = makeTmpHome();
    try {
      const result = runCli(['source', '--platform', 'ios'], { HOME: home });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(
        /no live session found in ~\/\.aco\/sessions/,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
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

  it('parseConnection rejects missing --session', () => {
    expect(() => parseConnection({ platform: 'ios' })).toThrow(
      /--session is required/,
    );
  });

  it('parseConnection rejects missing --platform', () => {
    expect(() => parseConnection({ session: 'sid' })).toThrow(
      /--platform is required/,
    );
  });

  it('resolveConnection with all three flags returns source flags without reading the store', () => {
    const result = resolveConnection({
      session: 'sid-explicit',
      serverUrl: 'http://elsewhere:5000',
      platform: 'ios',
    });
    expect(result.source).toBe('flags');
    expect(result.record).toBeUndefined();
    expect(result.conn.hostname).toBe('elsewhere');
    expect(result.conn.port).toBe(5000);
  });

  // The resolveConnection paths that read from ~/.aco/sessions are validated
  // end-to-end via the subprocess CLI tests below (where spawnSync's `env`
  // override actually reaches os.homedir(), unlike in-process env mutation
  // under vitest workers).

  it('aco session list --json returns the stub records (resolves via the store)', () => {
    const home = makeTmpHome();
    try {
      const rec: SessionRecord = {
        sessionId: 'list-1',
        serverUrl: 'http://127.0.0.1:9999',
        platform: 'ios',
        pid: 99999999,
        startedAt: new Date().toISOString(),
      };
      writeRecord(home, rec);
      const result = runCli(['session', 'list', '--json'], { HOME: home });
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as Array<
        SessionRecord & { alive: boolean | null }
      >;
      expect(parsed.length).toBe(1);
      expect(parsed[0]?.sessionId).toBe('list-1');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('aco session stop (no args) resolves to the latest live record', () => {
    const home = makeTmpHome();
    // Spawn a sacrificial child whose pid we'll use as the "alive" pid in
    // the stub record. The stop command SIGTERMs that pid, so it must not
    // be the test process pid.
    const child = spawn('node', ['-e', 'setTimeout(() => {}, 30000)'], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    try {
      const rec: SessionRecord = {
        sessionId: 'latest-1',
        serverUrl: 'http://127.0.0.1:1',
        platform: 'ios',
        pid: child.pid ?? 0,
        startedAt: new Date().toISOString(),
      };
      writeRecord(home, rec);
      const result = runCli(['session', 'stop'], { HOME: home });
      expect(result.status).toBe(0);
      expect(result.stderr).toMatch(/stopping latest-1/);
      expect(result.stderr).toMatch(/stopped latest-1/);
      expect(
        existsSync(join(home, '.aco', 'sessions', 'latest-1.json')),
      ).toBe(false);
    } finally {
      try {
        if (child.pid) process.kill(child.pid, 'SIGKILL');
      } catch {
        /* ignore */
      }
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('aco session stop --session <id> removes the file even when the network call fails', () => {
    const home = makeTmpHome();
    try {
      const rec: SessionRecord = {
        sessionId: 'stop-1',
        serverUrl: 'http://127.0.0.1:1',
        platform: 'ios',
        pid: 0,
        startedAt: new Date().toISOString(),
      };
      writeRecord(home, rec);
      const sessionsDir = join(home, '.aco', 'sessions');
      expect(readdirSync(sessionsDir).length).toBe(1);

      const result = runCli(['session', 'stop', '--session', 'stop-1'], {
        HOME: home,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toMatch(/stopping stop-1/);
      expect(result.stderr).toMatch(/stopped stop-1/);
      expect(existsSync(join(sessionsDir, 'stop-1.json'))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  // NOTE: `aco session start --detach` is not covered by automated tests in
  // this iteration. It would require a real `appium` binary on PATH (and an
  // AUT to connect to), which the rest of the suite also avoids. Manual smoke
  // tests live in the plan's Phase 10 checklist.
});
