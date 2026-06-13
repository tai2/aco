import type { Command } from '@commander-js/extra-typings';
import { buildCapabilities } from '../../lib/caps.js';
import {
  startAppiumServer,
  stopAppiumServer,
} from '../../lib/appium-server.js';
import { pickFreePort } from '../../lib/port.js';
import { createBrowser, DEFAULT_SESSION_TIMEOUT_MS } from '../../lib/wd-client.js';
import type { Platform } from '../../lib/connection.js';

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

export function registerSessionStart(session: Command): void {
  session
    .command('start')
    .description(
      'spin up an Appium server (sidecar) and create a session against an AUT. ' +
        'Runs in the foreground bound to the TTY; press Ctrl-C to tear down.',
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
    .action(async (opts) => {
      const platform = opts.platform.toLowerCase() as Platform;
      if (platform !== 'ios' && platform !== 'android') {
        throw new Error(
          `--platform must be "ios" or "android" (got "${opts.platform}")`,
        );
      }

      const capabilities = buildCapabilities({
        platform,
        app: opts.app,
        appActivity: opts.appActivity,
        deviceName: opts.deviceName,
        platformVersion: opts.platformVersion,
        udid: opts.udid,
        avd: opts.avd,
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
          !opts.avd &&
          !opts.udid &&
          /Could not find a connected Android device/i.test(msg)
        ) {
          process.stderr.write(
            'aco: hint -- on Android, pass `--avd <name>` (from `emulator -list-avds`) ' +
              'to auto-boot an emulator, or boot one yourself before running `session start`.\n',
          );
        }
        throw err;
      }

      const sessionId = browser.sessionId;

      process.stdout.write(
        JSON.stringify({
          sessionId,
          serverUrl: server.serverUrl,
          platform,
          pid: server.pid,
        }) + '\n',
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
