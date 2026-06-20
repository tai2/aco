import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startAppiumServer } from '../src/lib/appium-server.js';
import { parseConnection, resolveConnection } from '../src/lib/connection.js';
import { listAndroidAvds } from '../src/lib/devices/android.js';
import { renderTable, sortDevices } from '../src/lib/devices/format.js';
import type { Device } from '../src/lib/devices/types.js';
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
    `${JSON.stringify(rec, null, 2)}\n`,
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
    expect(result.stdout).toContain('actions');
  });

  it('aco actions --help surfaces the release flags', () => {
    const result = runCli(['actions', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--gesture');
    expect(result.stdout).toContain('--type');
    expect(result.stdout).toContain('--no-release');
    expect(result.stdout).toContain('--release-only');
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
      expect(existsSync(join(home, '.aco', 'sessions', 'latest-1.json'))).toBe(
        false,
      );
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

  it('aco session start --help documents the --allow-insecure passthrough', () => {
    const result = runCli(['session', 'start', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--allow-insecure');
    expect(result.stdout).toContain('chromedriver_autodownload');
  });

  it('aco session start --help documents the new server flags', () => {
    const result = runCli(['session', 'start', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--relaxed-security');
    expect(result.stdout).toContain('--deny-insecure');
    expect(result.stdout).toContain('--allow-cors');
    expect(result.stdout).toContain('--base-path');
    expect(result.stdout).toContain('--log-level');
    expect(result.stdout).toContain('--use-plugins');
    expect(result.stdout).toContain('--use-drivers');
    expect(result.stdout).toContain('--address');
    expect(result.stdout).toContain('--keep-alive-timeout');
    expect(result.stdout).toContain('--request-timeout');
    expect(result.stdout).toContain('--shutdown-timeout');
  });

  // NOTE: `aco session start --detach` is not covered by automated tests in
  // this iteration. It would require a real `appium` binary on PATH (and an
  // AUT to connect to), which the rest of the suite also avoids. Manual smoke
  // tests live in the plan's Phase 10 checklist.

  it('sortDevices orders booted < available < unknown < unavailable, ties by name', () => {
    const devices: Device[] = [
      {
        id: '1',
        name: 'Beta',
        platform: 'ios',
        kind: 'simulator',
        state: 'available',
      },
      {
        id: '2',
        name: 'Alpha',
        platform: 'ios',
        kind: 'simulator',
        state: 'unavailable',
      },
      {
        id: '3',
        name: 'Gamma',
        platform: 'ios',
        kind: 'simulator',
        state: 'booted',
      },
      {
        id: '4',
        name: 'Delta',
        platform: 'ios',
        kind: 'simulator',
        state: 'unknown',
      },
      {
        id: '5',
        name: 'Alpha',
        platform: 'ios',
        kind: 'simulator',
        state: 'available',
      },
    ];
    const sorted = sortDevices(devices).map((d) => `${d.state}:${d.name}`);
    expect(sorted).toEqual([
      'booted:Gamma',
      'available:Alpha',
      'available:Beta',
      'unknown:Delta',
      'unavailable:Alpha',
    ]);
  });

  it('renderTable returns the empty string for an empty list', () => {
    expect(renderTable([])).toBe('');
  });

  it('renderTable aligns columns when one row has a long device name', () => {
    const devices: Device[] = [
      {
        id: 'short-id',
        name: 'A',
        platform: 'ios',
        kind: 'simulator',
        state: 'available',
        platformVersion: '17.0',
        runtime: 'iOS 17.0',
      },
      {
        id: 'very-long-id-value',
        name: 'A-very-long-device-name-row',
        platform: 'ios',
        kind: 'simulator',
        state: 'available',
        platformVersion: '17.0',
        runtime: 'iOS 17.0',
      },
    ];
    const out = renderTable(devices);
    const lines = out.split('\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(3); // header + 2 rows
    const prefixLen = (line: string) => line.lastIndexOf('  ') + 2;
    const headerPrefix = prefixLen(lines[0] ?? '');
    expect(prefixLen(lines[1] ?? '')).toBe(headerPrefix);
    expect(prefixLen(lines[2] ?? '')).toBe(headerPrefix);
  });

  it('listAndroidAvds reads a synthesized AVD directory via ANDROID_AVD_HOME', async () => {
    const home = makeTmpHome();
    const avdDir = join(home, 'avds');
    mkdirSync(avdDir, { recursive: true });
    writeFileSync(
      join(avdDir, 'Foo.ini'),
      'target=android-33\npath=/some/where/Foo.avd\n',
    );
    const prev = {
      avd: process.env.ANDROID_AVD_HOME,
      emu: process.env.ANDROID_EMULATOR_HOME,
    };
    process.env.ANDROID_AVD_HOME = avdDir;
    process.env.ANDROID_EMULATOR_HOME = undefined;
    try {
      const result = await listAndroidAvds();
      expect(result.notes).toEqual([]);
      expect(result.devices.length).toBe(1);
      const d = result.devices[0];
      expect(d?.name).toBe('Foo');
      expect(d?.id).toBe('Foo');
      expect(d?.platform).toBe('android');
      expect(d?.kind).toBe('emulator');
      expect(d?.state).toBe('unknown');
      expect(d?.platformVersion).toBe('33');
      expect(d?.runtime).toBe('android-33');
    } finally {
      if (prev.avd === undefined) process.env.ANDROID_AVD_HOME = undefined;
      else process.env.ANDROID_AVD_HOME = prev.avd;
      if (prev.emu === undefined) process.env.ANDROID_EMULATOR_HOME = undefined;
      else process.env.ANDROID_EMULATOR_HOME = prev.emu;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('listAndroidAvds emits a "skipped" note when no env vars and no ~/.android/avd', async () => {
    const home = makeTmpHome();
    const prev = {
      avd: process.env.ANDROID_AVD_HOME,
      emu: process.env.ANDROID_EMULATOR_HOME,
      home: process.env.HOME,
    };
    process.env.ANDROID_AVD_HOME = undefined;
    process.env.ANDROID_EMULATOR_HOME = undefined;
    process.env.HOME = home;
    try {
      const result = await listAndroidAvds();
      expect(result.devices).toEqual([]);
      expect(result.notes.some((n) => /Android skipped/.test(n))).toBe(true);
    } finally {
      if (prev.avd === undefined) process.env.ANDROID_AVD_HOME = undefined;
      else process.env.ANDROID_AVD_HOME = prev.avd;
      if (prev.emu === undefined) process.env.ANDROID_EMULATOR_HOME = undefined;
      else process.env.ANDROID_EMULATOR_HOME = prev.emu;
      if (prev.home === undefined) process.env.HOME = undefined;
      else process.env.HOME = prev.home;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('listAndroidAvds falls back from ANDROID_AVD_HOME to ANDROID_EMULATOR_HOME/avd', async () => {
    const home = makeTmpHome();
    const emuHome = join(home, 'emu');
    const avdDir = join(emuHome, 'avd');
    mkdirSync(avdDir, { recursive: true });
    writeFileSync(join(avdDir, 'Fallback.ini'), 'target=android-30\n');
    const prev = {
      avd: process.env.ANDROID_AVD_HOME,
      emu: process.env.ANDROID_EMULATOR_HOME,
    };
    process.env.ANDROID_AVD_HOME = undefined;
    process.env.ANDROID_EMULATOR_HOME = emuHome;
    try {
      const result = await listAndroidAvds();
      expect(result.devices.length).toBe(1);
      expect(result.devices[0]?.name).toBe('Fallback');
      expect(result.devices[0]?.platformVersion).toBe('30');
    } finally {
      if (prev.avd === undefined) process.env.ANDROID_AVD_HOME = undefined;
      else process.env.ANDROID_AVD_HOME = prev.avd;
      if (prev.emu === undefined) process.env.ANDROID_EMULATOR_HOME = undefined;
      else process.env.ANDROID_EMULATOR_HOME = prev.emu;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('aco device list --help exits 0 and mentions discover and --platform', () => {
    const result = runCli(['device', 'list', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--platform');
    expect(result.stdout.toLowerCase()).toMatch(/simulators|avds/);
  });

  it('aco settings --help documents get and set subcommands', () => {
    const result = runCli(['settings', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('get');
    expect(result.stdout).toContain('set');
  });

  it('aco settings set --help documents --set and --json', () => {
    const result = runCli(['settings', 'set', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--set');
    expect(result.stdout).toContain('--json');
  });

  it('aco source --help documents --xpath', () => {
    const result = runCli(['source', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/--xpath/);
    expect(result.stdout).toMatch(/XPath/);
  });

  it('aco element displayed --help documents --element', () => {
    const result = runCli(['element', 'displayed', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--element');
  });

  it('aco element rect --help documents --element', () => {
    const result = runCli(['element', 'rect', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--element');
  });

  it('aco url --help documents the optional [url] argument', () => {
    const result = runCli(['url', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('url');
    expect(result.stdout).toContain('[url]');
  });

  it('aco timeouts --help documents get and set subcommands', () => {
    const result = runCli(['timeouts', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('get');
    expect(result.stdout).toContain('set');
  });

  it('aco orientation --help documents get and set subcommands', () => {
    const result = runCli(['orientation', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('get');
    expect(result.stdout).toContain('set');
  });

  it('aco orientation set --help documents the <orientation> argument', () => {
    const result = runCli(['orientation', 'set', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('orientation');
  });

  it('aco wait --help documents the locator and polling flags', () => {
    const result = runCli(['wait', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--using');
    expect(result.stdout).toContain('--value');
    expect(result.stdout).toContain('--for');
    expect(result.stdout).toContain('--timeout');
    expect(result.stdout).toContain('--interval');
  });

  it('aco status --help exits 0 and mentions /status', () => {
    const result = runCli(['status', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('status');
  });

  it('aco device list --json --platform android with synthetic ANDROID_AVD_HOME returns JSON', () => {
    const home = makeTmpHome();
    const avdDir = join(home, 'avds');
    mkdirSync(avdDir, { recursive: true });
    writeFileSync(
      join(avdDir, 'TestAvd.ini'),
      'target=android-34\npath=/tmp/whatever\n',
    );
    try {
      const result = runCli(
        ['device', 'list', '--json', '--platform', 'android'],
        {
          HOME: home,
          ANDROID_AVD_HOME: avdDir,
          ANDROID_EMULATOR_HOME: '',
        },
      );
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        devices: Device[];
        notes: string[];
      };
      expect(parsed.devices.length).toBe(1);
      expect(parsed.devices[0]?.platform).toBe('android');
      expect(parsed.devices[0]?.name).toBe('TestAvd');
      expect(parsed.devices[0]?.platformVersion).toBe('34');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('aco device list --platform pizza exits non-zero with a clear error', () => {
    const result = runCli(['device', 'list', '--platform', 'pizza']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--platform must be "ios" or "android"/);
  });

  it('aco device list --state booted --json with no booted devices returns devices: []', () => {
    const home = makeTmpHome();
    const avdDir = join(home, 'avds');
    mkdirSync(avdDir, { recursive: true });
    writeFileSync(join(avdDir, 'Quiet.ini'), 'target=android-33\n');
    try {
      const result = runCli(
        [
          'device',
          'list',
          '--platform',
          'android',
          '--state',
          'booted',
          '--json',
        ],
        {
          HOME: home,
          ANDROID_AVD_HOME: avdDir,
          ANDROID_EMULATOR_HOME: '',
        },
      );
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        devices: Device[];
        notes: string[];
      };
      expect(parsed.devices).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('aco device list --platform android --json with no AVDs returns empty + skipped note', () => {
    const home = makeTmpHome();
    try {
      const result = runCli(
        ['device', 'list', '--platform', 'android', '--json'],
        {
          HOME: home,
          ANDROID_AVD_HOME: '',
          ANDROID_EMULATOR_HOME: '',
        },
      );
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        devices: Device[];
        notes: string[];
      };
      expect(parsed.devices).toEqual([]);
      expect(parsed.notes.some((n) => /Android skipped/.test(n))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return false;
    return true; // e.g. EPERM -- the process exists, we just can't signal it
  }
}

async function waitUntilDead(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await delay(50);
  }
  return !isAlive(pid);
}

describe('startAppiumServer cleanup', () => {
  // Regression: if appium spawns but never serves /status, waitForReady throws
  // and startAppiumServer must tear the child down before rejecting. Otherwise
  // the never-binding child is leaked as a zombie after aco exits.
  it('SIGTERMs the spawned child when it never becomes ready', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aco-fakeappium-'));
    const pidFile = join(dir, 'appium.pid');
    // A fake `appium` that records its pid and then hangs forever without ever
    // binding a port -- exactly the "starts but never serves /status" case.
    const fakeAppium = join(dir, 'appium');
    writeFileSync(
      fakeAppium,
      [
        '#!/usr/bin/env node',
        `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`,
        'setInterval(() => {}, 1000);',
        '',
      ].join('\n'),
      { mode: 0o755 },
    );
    chmodSync(fakeAppium, 0o755);

    const port = 47999;
    const savedPath = process.env.PATH;
    const savedHome = process.env.HOME;
    process.env.PATH = `${dir}:${savedPath ?? ''}`;
    // Redirect HOME so the server's ~/.aco/logs write lands in the temp dir
    // (os.homedir() honors $HOME on POSIX) and is cleaned with the rest.
    process.env.HOME = dir;
    let childPid: number | undefined;
    try {
      await expect(
        startAppiumServer({ port, readyTimeoutMs: 500 }),
      ).rejects.toThrow(/did not become ready/);

      childPid = Number.parseInt(readFileSync(pidFile, 'utf8'), 10);
      expect(Number.isFinite(childPid)).toBe(true);
      expect(await waitUntilDead(childPid, 3000)).toBe(true);
    } finally {
      if (childPid && isAlive(childPid)) {
        try {
          process.kill(childPid, 'SIGKILL');
        } catch {
          /* ignore */
        }
      }
      process.env.PATH = savedPath;
      process.env.HOME = savedHome;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Locks the lib-level CLI-flag -> appium argv translation without a real
  // Appium: the fake records its own argv, then serves /status so
  // waitForReady resolves and we can inspect what was forwarded.
  it('forwards the new server flags into the spawned appium argv', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aco-fakeappium-'));
    const argvFile = join(dir, 'argv.json');
    const fakeAppium = join(dir, 'appium');
    writeFileSync(
      fakeAppium,
      [
        '#!/usr/bin/env node',
        'const http = require("node:http");',
        'const fs = require("node:fs");',
        `fs.writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));`,
        'const args = process.argv.slice(2);',
        'const port = Number(args[args.indexOf("--port") + 1]);',
        'const host = args[args.indexOf("--address") + 1];',
        'const basePath = args[args.indexOf("--base-path") + 1];',
        'const statusPath = basePath.replace(/\\/+$/, "") + "/status";',
        'const server = http.createServer((req, res) => {',
        '  if (req.url === statusPath) { res.writeHead(200); res.end("{}"); return; }',
        '  res.writeHead(404); res.end();',
        '});',
        'server.listen(port, host);',
        '',
      ].join('\n'),
      { mode: 0o755 },
    );
    chmodSync(fakeAppium, 0o755);

    const port = 47998;
    const savedPath = process.env.PATH;
    const savedHome = process.env.HOME;
    process.env.PATH = `${dir}:${savedPath ?? ''}`;
    process.env.HOME = dir;
    let pid: number | undefined;
    try {
      const server = await startAppiumServer({
        port,
        hostname: '0.0.0.0',
        basePath: '/wd/hub',
        logLevel: 'debug',
        relaxedSecurity: true,
        denyInsecure: ['adb_shell'],
        allowCors: true,
        useDrivers: ['xcuitest'],
        usePlugins: ['images'],
        keepAliveTimeout: 0,
        requestTimeout: 7200,
        shutdownTimeout: 1000,
        readyTimeoutMs: 5000,
      });
      pid = server.pid;

      // serverUrl must carry the base-path so the session record and attach
      // subcommands route under it (parseConnection derives basePath back out).
      expect(server.serverUrl).toBe('http://0.0.0.0:47998/wd/hub');

      const argv = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
      const flagValue = (flag: string) => argv[argv.indexOf(flag) + 1];

      expect(flagValue('--address')).toBe('0.0.0.0');
      expect(flagValue('--base-path')).toBe('/wd/hub');
      expect(flagValue('--log-level')).toBe('debug');
      expect(argv).toContain('--relaxed-security');
      expect(argv).toContain('--allow-cors');
      expect(flagValue('--deny-insecure')).toBe('adb_shell');
      expect(flagValue('--use-drivers')).toBe('xcuitest');
      expect(flagValue('--use-plugins')).toBe('images');
      // 0 is a meaningful value ("disable"); the gate is !== undefined, so it
      // must survive rather than being dropped as falsy.
      expect(flagValue('--keep-alive-timeout')).toBe('0');
      expect(flagValue('--request-timeout')).toBe('7200');
      expect(flagValue('--shutdown-timeout')).toBe('1000');
    } finally {
      if (pid && isAlive(pid)) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          /* ignore */
        }
      }
      process.env.PATH = savedPath;
      process.env.HOME = savedHome;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
