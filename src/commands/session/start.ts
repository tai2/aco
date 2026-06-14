import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Command } from '@commander-js/extra-typings';
import {
  startAppiumServer,
  stopAppiumServer,
} from '../../lib/appium-server.js';
import { buildCapabilities } from '../../lib/caps.js';
import type { Platform } from '../../lib/connection.js';
import { listAndroidAvds } from '../../lib/devices/android.js';
import { pickFreePort } from '../../lib/port.js';
import {
  type SessionRecord,
  removeSession,
  saveSession,
} from '../../lib/session-store.js';
import {
  DEFAULT_SESSION_TIMEOUT_MS,
  createBrowser,
} from '../../lib/wd-client.js';

function parseExtraCaps(values: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of values ?? []) {
    const idx = v.indexOf('=');
    if (idx < 0) throw new Error(`--cap expects key=value, got "${v}"`);
    const key = v.slice(0, idx);
    const raw = v.slice(idx + 1);
    try {
      out[key] = JSON.parse(raw) as unknown;
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

function readFirstLine(
  stream: NodeJS.ReadableStream,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const cleanup = () => {
      clearTimeout(timer);
      stream.off('data', onData);
      stream.off('error', onErr);
    };
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        cleanup();
        resolve(buf.slice(0, nl));
      }
    };
    const onErr = (err: Error) => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `detached child did not emit a session envelope within ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
    stream.on('data', onData);
    stream.on('error', onErr);
  });
}

async function detachAndExit(): Promise<void> {
  const entry = process.argv[1];
  if (!entry || !entry.endsWith('.js')) {
    process.stderr.write(
      'aco: --detach is not supported in dev mode (tsx). ' +
        'Run the built `dist/cli.js` to use --detach.\n',
    );
    process.exit(2);
  }

  const filteredArgs = process.argv.slice(2).filter((a) => a !== '--detach');

  mkdirSync(join(homedir(), '.aco', 'logs'), { recursive: true });
  const bootstrapLog = createWriteStream(
    join(homedir(), '.aco', 'logs', `aco-detach-${process.pid}.log`),
    { flags: 'a' },
  );

  const child = spawn(process.execPath, [entry, ...filteredArgs], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    windowsHide: true,
  });

  if (!child.stdout || !child.stderr) {
    throw new Error('aco: failed to capture detached child stdio');
  }

  const envelope = await readFirstLine(child.stdout, 60_000);

  child.stdout.pipe(bootstrapLog);
  child.stderr.pipe(bootstrapLog);

  process.stdout.write(`${envelope}\n`);
  process.stderr.write(
    `session detached -- pid ${child.pid}, stop with \`aco session stop\`\n`,
  );

  child.unref();
  process.exit(0);
}

export function registerSessionStart(session: Command): void {
  session
    .command('start')
    .description(
      'spin up an Appium server (sidecar) and create a session against an AUT. ' +
        'Runs in the foreground bound to the TTY by default; use --detach for background.',
    )
    .requiredOption('-p, --platform <ios|android>', 'target platform')
    .option(
      '-a, --app <path-or-id>',
      'path to the AUT build, or bundleId/appPackage',
    )
    .option(
      '-A, --app-activity <activity>',
      'Android only -- launchable activity (required when --app is an appPackage id)',
    )
    .option(
      '-d, --device-name <name>',
      'appium:deviceName (iOS simulator label, e.g. "iPhone 15"; informational on Android -- use --avd to pick the emulator)',
    )
    .option('-V, --platform-version <ver>', 'appium:platformVersion')
    .option('-u, --udid <udid>', 'appium:udid')
    .option(
      '--avd <name>',
      'Android only -- AVD name of the emulator to target (appium:avd)',
    )
    .option(
      '--port <port>',
      'preferred Appium port (default: 4723)',
      (v) => Number.parseInt(v, 10),
      4723,
    )
    .option('--cap <key=value...>', 'extra W3C capability (repeatable)')
    .option(
      '--session-timeout <seconds>',
      `time to wait for session creation before aborting (default: ${DEFAULT_SESSION_TIMEOUT_MS / 1000}s; bump it for cold simulator/WDA boots)`,
      (v) => Number.parseInt(v, 10),
      DEFAULT_SESSION_TIMEOUT_MS / 1000,
    )
    .option(
      '--log',
      'stream the full Appium server log to stdout (in addition to ~/.aco/logs)',
    )
    .option(
      '--detach',
      'run in the background; print envelope on stdout then exit immediately',
    )
    .action(async (opts) => {
      if (opts.detach) {
        await detachAndExit();
        return;
      }

      const platform = opts.platform.toLowerCase() as Platform;
      if (platform !== 'ios' && platform !== 'android') {
        throw new Error(
          `--platform must be "ios" or "android" (got "${opts.platform}")`,
        );
      }

      // On Android, Appium will not auto-boot an emulator unless we tell it
      // which AVD to use (or the user has booted one and passes --udid).
      // When neither is given, default to the first discoverable AVD so
      // `session start --platform android` works out of the box.
      let avd = opts.avd;
      if (platform === 'android' && !avd && !opts.udid) {
        const { devices } = await listAndroidAvds();
        const first = devices[0];
        if (!first) {
          throw new Error(
            'aco: no Android AVD found to boot. Create one in Android Studio, ' +
              'or boot an emulator yourself and pass `--udid`. ' +
              'See `aco device list --platform android`.',
          );
        }
        avd = first.name;
        process.stderr.write(`aco: no --avd given, using "${avd}"\n`);
      }

      const capabilities = buildCapabilities({
        platform,
        app: opts.app,
        appActivity: opts.appActivity,
        deviceName: opts.deviceName,
        platformVersion: opts.platformVersion,
        udid: opts.udid,
        avd,
        extraCaps: parseExtraCaps(opts.cap),
      });

      const port = await pickFreePort(opts.port);
      const server = await startAppiumServer({ port, tee: Boolean(opts.log) });

      let browser: WebdriverIO.Browser;
      try {
        browser = await createBrowser({
          hostname: server.hostname,
          port: server.port,
          basePath: server.basePath,
          capabilities,
          connectionTimeoutMs: opts.sessionTimeout * 1000,
        });
      } catch (err) {
        try {
          process.kill(server.pid, 'SIGTERM');
        } catch {
          /* ignore */
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (
          platform === 'android' &&
          !opts.udid &&
          /Could not find a connected Android device/i.test(msg)
        ) {
          process.stderr.write(
            `aco: hint -- the AVD "${avd}" did not come up in time. ` +
              'Bump `--session-timeout` for a cold boot, pick another AVD with ' +
              '`--avd <name>` (see `aco device list --platform android`), ' +
              'or boot an emulator yourself before running `session start`.\n',
          );
        }
        throw err;
      }

      const record: SessionRecord = {
        sessionId: browser.sessionId,
        serverUrl: server.serverUrl,
        platform,
        pid: server.pid,
        startedAt: new Date().toISOString(),
        deviceName: opts.deviceName,
        app: opts.app,
      };
      saveSession(record);

      process.stdout.write(
        `${JSON.stringify({
          sessionId: record.sessionId,
          serverUrl: record.serverUrl,
          platform: record.platform,
          pid: record.pid,
        })}\n`,
      );
      process.stderr.write('session ready -- press Ctrl-C to stop\n');

      let cleaningUp = false;
      let exitCode = 0;
      const cleanup = async (reason: 'signal' | 'child-exit') => {
        if (cleaningUp) return;
        cleaningUp = true;
        if (reason === 'child-exit') {
          exitCode = 1;
          process.stderr.write(
            'aco: Appium server exited unexpectedly, cleaning up\n',
          );
        }
        try {
          await browser.deleteSession();
        } catch (err) {
          process.stderr.write(
            `aco: warning, deleteSession failed: ${(err as Error).message}\n`,
          );
        }
        if (reason === 'signal' && server.pid) {
          await stopAppiumServer(server.pid);
        }
        removeSession(record.sessionId);
        process.exit(exitCode);
      };

      for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]) {
        process.on(sig, () => {
          void cleanup('signal');
        });
      }
      server.child.once('exit', () => {
        void cleanup('child-exit');
      });

      await new Promise<void>(() => {});
    });
}
