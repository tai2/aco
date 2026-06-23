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
import { parseCapsJson, resolveAuth } from '../src/commands/session/start.js';
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

  it('aco send-keys --help surfaces the selector, text, and --no-clear flags', () => {
    const result = runCli(['send-keys', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--selector');
    expect(result.stdout).toContain('--text');
    expect(result.stdout).toContain('--no-clear');
  });

  it('top-level --help lists the send-keys command', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('send-keys');
  });

  it('aco swipe --help surfaces the targeting and gesture flags', () => {
    const result = runCli(['swipe', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--selector');
    expect(result.stdout).toContain('--label');
    expect(result.stdout).toContain('--element');
    expect(result.stdout).toContain('--direction');
    expect(result.stdout).toContain('--duration');
    expect(result.stdout).toContain('--percent');
    expect(result.stdout).toContain('--from');
    expect(result.stdout).toContain('--to');
  });

  it('aco swipe rejects more than one element source', () => {
    const result = runCli(['swipe', '--label', 'a', '--element', 'b']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'pass at most one of --selector, --label, --element',
    );
  });

  it('aco swipe rejects --from without --to', () => {
    const result = runCli(['swipe', '--from', '1,2']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('pass both --from and --to, or neither');
  });

  it('aco swipe rejects coordinates combined with an element', () => {
    const result = runCli([
      'swipe',
      '--label',
      'a',
      '--from',
      '1,2',
      '--to',
      '3,4',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--from/--to are ignored');
  });

  it('aco swipe rejects an invalid --direction', () => {
    const result = runCli(['swipe', '--direction', 'sideways']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--direction must be up|down|left|right');
  });

  it('aco element property --help documents --element and --name', () => {
    const result = runCli(['element', 'property', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--element');
    expect(result.stdout).toContain('--name');
  });

  it('aco ios --help lists generated extensions as first-class commands', () => {
    const result = runCli(['ios', '--help']);
    expect(result.status).toBe(0);
    // snake-cased leaves derived from the pinned XCUITest manifest
    expect(result.stdout).toContain('tap');
    expect(result.stdout).toContain('double-tap');
    expect(result.stdout).toContain('select-picker-wheel-value');
    expect(result.stdout).toMatch(/pinned driver source/);
  });

  it('aco android --help lists generated extensions as first-class commands', () => {
    const result = runCli(['android', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('shell');
    expect(result.stdout).toContain('click-gesture');
    expect(result.stdout).toContain('drag-gesture');
  });

  it('aco ios tap --help shows source-derived typed param help', () => {
    const result = runCli(['ios', 'tap', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/--x <value>.*\(number\)/s);
    expect(result.stdout).toMatch(/--y <value>.*\(number\)/s);
    expect(result.stdout).toMatch(/--elementId <value>.*\(string\)/s);
    // connection flags still sort last
    expect(result.stdout).toContain('--session');
  });

  it('aco mobile call --help documents it as an unvalidated escape hatch', () => {
    const result = runCli(['mobile', 'call', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('unvalidated');
    expect(result.stdout).toContain('--name');
    expect(result.stdout).toContain('--args');
  });

  it('aco mobile list --help mentions the live extensions endpoint', () => {
    const result = runCli(['mobile', 'list', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('/session/:id/appium/extensions');
    expect(result.stdout).toContain('--json');
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

  it('aco session start --help documents the remote-server and auth flags', () => {
    const result = runCli(['session', 'start', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--server-url');
    expect(result.stdout).toContain('--username');
    expect(result.stdout).toContain('--password');
    expect(result.stdout).toContain('--auth');
    expect(result.stdout).toContain('--caps-json');
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

  it('aco element active --help describes the active-element lookup', () => {
    const result = runCli(['element', 'active', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('GET /element/active');
  });

  it('aco web url --help documents the optional [url] argument', () => {
    const result = runCli(['web', 'url', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('url');
    expect(result.stdout).toContain('[url]');
  });

  it('aco web --help lists the web navigation subcommands', () => {
    const result = runCli(['web', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('url');
    expect(result.stdout).toContain('back');
    expect(result.stdout).toContain('forward');
    expect(result.stdout).toContain('refresh');
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

describe('resolveAuth', () => {
  it('splits --auth "user:pass" on the first colon', () => {
    expect(resolveAuth({ auth: 'alice:s3cr3t:with:colons' })).toEqual({
      user: 'alice',
      key: 's3cr3t:with:colons',
    });
  });

  it('throws when --auth has no colon', () => {
    expect(() => resolveAuth({ auth: 'nocolon' })).toThrow(
      /--auth expects "user:password"/,
    );
  });

  it('throws when --auth is combined with --username', () => {
    expect(() => resolveAuth({ auth: 'a:b', username: 'c' })).toThrow(
      /--auth cannot be combined with --username\/--password/,
    );
  });

  it('throws when --username is given without --password', () => {
    expect(() => resolveAuth({ username: 'alice' })).toThrow(
      /--username and --password must be given together/,
    );
  });

  it('returns {} when no credentials are supplied', () => {
    withRemoteAuthEnv({ user: undefined, key: undefined }, () => {
      expect(resolveAuth({})).toEqual({});
    });
  });

  it('falls back to ACO_REMOTE_* env vars, but flags win', () => {
    withRemoteAuthEnv({ user: 'envuser', key: 'envpass' }, () => {
      expect(resolveAuth({})).toEqual({ user: 'envuser', key: 'envpass' });
      // Flags take precedence over the env fallback.
      expect(resolveAuth({ auth: 'flaguser:flagpass' })).toEqual({
        user: 'flaguser',
        key: 'flagpass',
      });
    });
  });
});

describe('parseCapsJson', () => {
  it('parses an inline JSON object, preserving nested vendor caps', () => {
    const caps = parseCapsJson(
      '{"platformName":"android","lt:options":{"isRealMobile":true,"deviceName":"Pixel 8"}}',
    );
    expect(caps).toEqual({
      platformName: 'android',
      'lt:options': { isRealMobile: true, deviceName: 'Pixel 8' },
    });
  });

  it('reads JSON from an @file path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aco-caps-'));
    const file = join(dir, 'caps.json');
    writeFileSync(file, '{"lt:options":{"build":"smoke"}}');
    try {
      expect(parseCapsJson(`@${file}`)).toEqual({
        'lt:options': { build: 'smoke' },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws a clear error for an @file that does not exist', () => {
    expect(() => parseCapsJson('@/no/such/caps.json')).toThrow(
      /--caps-json: cannot read file/,
    );
  });

  it('throws when the JSON is malformed', () => {
    expect(() => parseCapsJson('{not json}')).toThrow(
      /--caps-json is not valid JSON/,
    );
  });

  it('throws when the JSON is not an object (array)', () => {
    expect(() => parseCapsJson('[1,2,3]')).toThrow(
      /--caps-json must be a JSON object/,
    );
  });

  it('throws when the JSON is not an object (primitive)', () => {
    expect(() => parseCapsJson('"oops"')).toThrow(
      /--caps-json must be a JSON object/,
    );
  });
});

// Run `fn` with ACO_REMOTE_USERNAME/PASSWORD set to the given values (undefined
// => unset), restoring the prior environment afterwards.
function withRemoteAuthEnv(
  values: { user: string | undefined; key: string | undefined },
  fn: () => void,
): void {
  const setOrUnset = (name: string, value: string | undefined) => {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
  };
  const saved = {
    user: process.env.ACO_REMOTE_USERNAME,
    key: process.env.ACO_REMOTE_PASSWORD,
  };
  setOrUnset('ACO_REMOTE_USERNAME', values.user);
  setOrUnset('ACO_REMOTE_PASSWORD', values.key);
  try {
    fn();
  } finally {
    setOrUnset('ACO_REMOTE_USERNAME', saved.user);
    setOrUnset('ACO_REMOTE_PASSWORD', saved.key);
  }
}

// A stub Appium server that records each request (method/url/auth) as a JSON
// line to a log file and answers POST /session + GET /source. It must run in a
// SEPARATE process: runCli uses spawnSync, which blocks this process's event
// loop, so an in-process server could never answer the CLI's requests.
const STUB_SERVER_SOURCE = [
  'const http = require("node:http");',
  'const fs = require("node:fs");',
  'const [, , logFile, portFile] = process.argv;',
  'const server = http.createServer((req, res) => {',
  '  let body = "";',
  '  req.on("data", (c) => { body += c; });',
  '  req.on("end", () => {',
  '    fs.appendFileSync(logFile, JSON.stringify({ method: req.method, url: req.url, auth: req.headers.authorization ?? null, body: body }) + "\\n");',
  '    const url = req.url || "";',
  '    if (req.method === "POST" && url.endsWith("/session")) {',
  '      res.writeHead(200, { "content-type": "application/json" });',
  '      res.end(JSON.stringify({ value: { sessionId: "remote-sess-1", capabilities: { platformName: "iOS" } } }));',
  '      return;',
  '    }',
  '    if (req.method === "GET" && url.endsWith("/source")) {',
  '      res.writeHead(200, { "content-type": "application/json" });',
  '      res.end(JSON.stringify({ value: "<AppiumAUT/>" }));',
  '      return;',
  '    }',
  '    res.writeHead(404, { "content-type": "application/json" });',
  '    res.end("{}");',
  '  });',
  '});',
  'server.listen(0, "127.0.0.1", () => {',
  '  fs.writeFileSync(portFile, String(server.address().port));',
  '});',
  '',
].join('\n');

describe('remote server mode (--server-url)', () => {
  // session start (remote mode) must (a) send BASIC auth only on POST /session,
  // (b) never spawn a local `appium`, and a follow-up consumer command must
  // send no auth at all.
  it('sends BASIC auth only on session creation and spawns no local appium', async () => {
    const home = makeTmpHome();
    const binDir = join(home, 'bin');
    mkdirSync(binDir, { recursive: true });

    const stubPath = join(home, 'stub-appium.cjs');
    writeFileSync(stubPath, STUB_SERVER_SOURCE);
    const logFile = join(home, 'requests.log');
    const portFile = join(home, 'port');

    // A fake `appium` that records if it was ever invoked. Remote mode must not
    // spawn it, so this marker must never appear.
    const marker = join(home, 'appium-was-spawned');
    const fakeAppium = join(binDir, 'appium');
    writeFileSync(fakeAppium, `#!/bin/sh\ntouch ${JSON.stringify(marker)}\n`, {
      mode: 0o755,
    });
    chmodSync(fakeAppium, 0o755);

    const stub = spawn('node', [stubPath, logFile, portFile], {
      stdio: 'ignore',
    });
    try {
      // Wait for the stub to bind and publish its port.
      const deadline = Date.now() + 5000;
      while (!existsSync(portFile) && Date.now() < deadline) {
        await delay(25);
      }
      const port = Number.parseInt(readFileSync(portFile, 'utf8'), 10);
      expect(Number.isFinite(port)).toBe(true);
      const serverUrl = `http://127.0.0.1:${port}`;

      const env = { HOME: home, PATH: `${binDir}:${process.env.PATH ?? ''}` };

      const start = runCli(
        [
          'session',
          'start',
          '--platform',
          'ios',
          '--server-url',
          serverUrl,
          '--auth',
          'user:pass',
          '--session-timeout',
          '20',
        ],
        env,
      );
      expect(start.status).toBe(0);
      const envelope = JSON.parse(start.stdout.trim()) as {
        sessionId: string;
        pid: number;
        serverUrl: string;
      };
      expect(envelope.sessionId).toBe('remote-sess-1');
      expect(envelope.pid).toBe(0);
      expect(envelope.serverUrl).toBe(serverUrl);

      // No local appium child was spawned.
      expect(existsSync(marker)).toBe(false);

      // A follow-up in-session command attaches with no auth.
      const source = runCli(
        [
          'source',
          '--session',
          'remote-sess-1',
          '--server-url',
          serverUrl,
          '--platform',
          'ios',
        ],
        env,
      );
      expect(source.status).toBe(0);

      type Seen = { method?: string; url?: string; auth: string | null };
      const requests = readFileSync(logFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Seen);

      const sessionReq = requests.find(
        (r) => r.method === 'POST' && (r.url ?? '').endsWith('/session'),
      );
      expect(sessionReq).toBeDefined();
      const expectedAuth = `Basic ${Buffer.from('user:pass').toString('base64')}`;
      expect(sessionReq?.auth).toBe(expectedAuth);

      const sourceReq = requests.find((r) => (r.url ?? '').endsWith('/source'));
      expect(sourceReq).toBeDefined();
      expect(sourceReq?.auth).toBe(null);
    } finally {
      stub.kill('SIGKILL');
      rmSync(home, { recursive: true, force: true });
    }
  });

  // --caps-json is the device-farm escape hatch: the supplied object is sent on
  // POST /session verbatim (nested vendor caps intact), and aco's per-flag caps
  // (e.g. appium:newCommandTimeout) are NOT injected.
  it('sends --caps-json verbatim and bypasses aco-built capabilities', async () => {
    const home = makeTmpHome();
    const stubPath = join(home, 'stub-appium.cjs');
    writeFileSync(stubPath, STUB_SERVER_SOURCE);
    const logFile = join(home, 'requests.log');
    const portFile = join(home, 'port');

    const stub = spawn('node', [stubPath, logFile, portFile], {
      stdio: 'ignore',
    });
    try {
      const deadline = Date.now() + 5000;
      while (!existsSync(portFile) && Date.now() < deadline) {
        await delay(25);
      }
      const port = Number.parseInt(readFileSync(portFile, 'utf8'), 10);
      const serverUrl = `http://127.0.0.1:${port}`;
      const env = { HOME: home, PATH: process.env.PATH ?? '' };

      const capsJson = JSON.stringify({
        platformName: 'android',
        'lt:options': { isRealMobile: true, deviceName: 'Pixel 8' },
      });

      const start = runCli(
        [
          'session',
          'start',
          '--platform',
          'android',
          '--server-url',
          serverUrl,
          '--caps-json',
          capsJson,
          // A per-device flag that must be ignored (and warned about).
          '--device-name',
          'ignored',
          // A --cap override that must shallow-merge on top.
          '--cap',
          'lt:options={"isRealMobile":true,"deviceName":"Pixel 8","build":"smoke"}',
          '--session-timeout',
          '20',
        ],
        env,
      );
      expect(start.status).toBe(0);
      expect(start.stderr).toContain('ignoring per-device flags');
      expect(start.stderr).toContain('--device-name');

      type Seen = { method?: string; url?: string; body?: string };
      const requests = readFileSync(logFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Seen);
      const sessionReq = requests.find(
        (r) => r.method === 'POST' && (r.url ?? '').endsWith('/session'),
      );
      expect(sessionReq).toBeDefined();
      const sent = JSON.parse(sessionReq?.body ?? '{}') as {
        capabilities: { alwaysMatch: Record<string, unknown> };
      };
      const always = sent.capabilities.alwaysMatch;
      // Vendor caps preserved verbatim, with the --cap override merged on top.
      expect(always['lt:options']).toEqual({
        isRealMobile: true,
        deviceName: 'Pixel 8',
        build: 'smoke',
      });
      expect(always.platformName).toBe('android');
      // aco's per-flag caps were NOT injected.
      expect(always['appium:newCommandTimeout']).toBeUndefined();
      expect(always['appium:automationName']).toBeUndefined();
      expect(always['appium:deviceName']).toBeUndefined();
    } finally {
      stub.kill('SIGKILL');
      rmSync(home, { recursive: true, force: true });
    }
  });
});
