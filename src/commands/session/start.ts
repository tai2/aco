import { spawn } from 'node:child_process';
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
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
import {
  listAndroidRealDevices,
  listIosRealDevices,
} from '../../lib/devices/index.js';
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

export function parseCapsJson(value: string): Record<string, unknown> {
  let raw = value;
  if (value.startsWith('@')) {
    const path = value.slice(1);
    try {
      raw = readFileSync(path, 'utf8');
    } catch (err) {
      throw new Error(
        `--caps-json: cannot read file ${path}: ${(err as Error).message}`,
      );
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`--caps-json is not valid JSON: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      '--caps-json must be a JSON object (the W3C capabilities map)',
    );
  }
  return parsed as Record<string, unknown>;
}

export function resolveAuth(opts: {
  username?: string;
  password?: string;
  auth?: string;
}): { user?: string; key?: string } {
  if (opts.auth !== undefined) {
    if (opts.username !== undefined || opts.password !== undefined) {
      throw new Error('--auth cannot be combined with --username/--password');
    }
    const idx = opts.auth.indexOf(':');
    if (idx < 0) {
      throw new Error('--auth expects "user:password"');
    }
    return { user: opts.auth.slice(0, idx), key: opts.auth.slice(idx + 1) };
  }
  if (opts.username !== undefined || opts.password !== undefined) {
    if (opts.username === undefined || opts.password === undefined) {
      throw new Error('--username and --password must be given together');
    }
    return { user: opts.username, key: opts.password };
  }
  // Fallback to env vars so credentials need not appear in shell history /
  // process args. Flags above always win.
  const envUser = process.env.ACO_REMOTE_USERNAME;
  const envKey = process.env.ACO_REMOTE_PASSWORD;
  if (envUser !== undefined || envKey !== undefined) {
    if (envUser === undefined || envKey === undefined) {
      throw new Error(
        'ACO_REMOTE_USERNAME and ACO_REMOTE_PASSWORD must be set together',
      );
    }
    return { user: envUser, key: envKey };
  }
  return {};
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

async function detachAndExit(sessionTimeoutSec: number): Promise<void> {
  // process.argv[1] is the path as invoked. A global npm/Homebrew install runs
  // aco through a `bin` symlink (e.g. /opt/homebrew/bin/aco) that has no `.js`
  // extension, so resolve it to the real file before deciding dev vs. built --
  // otherwise the built CLI is mistaken for dev mode. Under tsx (`pnpm dev`)
  // this resolves to src/cli.ts, which is correctly rejected below.
  const invoked = process.argv[1];
  let entry: string | undefined;
  try {
    entry = invoked ? realpathSync(invoked) : undefined;
  } catch {
    entry = invoked;
  }
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

  // The envelope only lands once the session is created, so wait at least as
  // long as the child's own --session-timeout, plus a margin for the Appium
  // server to boot. A flat 60s here would defeat --session-timeout on cold
  // simulator/WDA boots and kill a session that was still coming up.
  const envelopeTimeoutMs = (sessionTimeoutSec + 60) * 1000;

  // Buffer the child's stderr from the start: if it dies before emitting an
  // envelope, this is the only place the real Appium/WDA failure is visible.
  let earlyErr = '';
  const onEarlyErr = (chunk: Buffer) => {
    earlyErr += chunk.toString('utf8');
  };
  child.stderr.on('data', onEarlyErr);

  let envelope: string;
  try {
    envelope = await Promise.race([
      readFirstLine(child.stdout, envelopeTimeoutMs),
      new Promise<never>((_, reject) => {
        child.once('exit', (code, signal) => {
          const how = signal ? `signal ${signal}` : `code ${code}`;
          reject(
            new Error(
              `aco: session start exited (${how}) before creating a session\n${earlyErr}`,
            ),
          );
        });
      }),
    ]);
  } catch (err) {
    bootstrapLog.write(earlyErr);
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }

  child.stderr.off('data', onEarlyErr);
  bootstrapLog.write(earlyErr);
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
      '--xcode-org-id <id>',
      'iOS real device -- appium:xcodeOrgId (Apple Team ID for WDA signing)',
    )
    .option(
      '--xcode-signing-id <id>',
      'iOS real device -- appium:xcodeSigningId (default "iPhone Developer")',
    )
    .option(
      '--allow-provisioning-device-registration',
      'iOS real device -- appium:allowProvisioningDeviceRegistration ' +
        '(let Xcode register the device with your provisioning profile)',
    )
    .option(
      '--updated-wda-bundle-id <id>',
      'iOS real device -- appium:updatedWDABundleId (custom WDA bundle id for signing)',
    )
    .option(
      '--port <port>',
      'preferred Appium port (default: 4723)',
      (v) => Number.parseInt(v, 10),
      4723,
    )
    .option(
      '-S, --server-url <url>',
      'attach to an existing remote Appium server (e.g. a device farm grid) ' +
        'instead of spawning a local one. When set, --port and the local ' +
        'server flags (--address, --log-level, --use-drivers, ...) are ignored.',
    )
    .option(
      '--username <user>',
      'BASIC auth username for the remote server (sent only on session creation)',
    )
    .option(
      '--password <pass>',
      'BASIC auth password for the remote server (sent only on session creation)',
    )
    .option(
      '--auth <user:pass>',
      'BASIC auth as "user:password" (alternative to --username/--password; ' +
        'value before the first ":" is the user)',
    )
    .option('--cap <key=value...>', 'extra W3C capability (repeatable)')
    .option(
      '--caps-json <json>',
      'verbatim W3C capabilities as a JSON object (or @file to read from a ' +
        'file), bypassing aco-built caps. Escape hatch for device farms with ' +
        'nested vendor caps (e.g. LambdaTest\'s "lt:options"). Per-device flags ' +
        '(--app, --device-name, --udid, ...) are ignored; --cap entries still ' +
        'merge on top (shallow). --platform is still required for the record.',
    )
    .option(
      '--allow-insecure <feature...>',
      'Appium insecure feature(s) to enable on the server. Appium 3 requires ' +
        'each feature scoped to a driver or "*" ' +
        '(e.g. uiautomator2:chromedriver_autodownload for Android webview automation)',
    )
    .option(
      '--deny-insecure <feature...>',
      'Appium insecure feature(s) to disable. Only takes effect with ' +
        '--allow-insecure or --relaxed-security, and is applied last (deny wins)',
    )
    .option(
      '--relaxed-security',
      'enable Appium --relaxed-security (allow all insecure features). ' +
        'Use only on a trusted local network; claw back features with --deny-insecure',
    )
    .option('--allow-cors', 'allow browser (CORS) connections to the server')
    .option(
      '--base-path <path>',
      'URL prefix for all WebDriver routes on the spawned server (default: /)',
    )
    .option(
      '--log-level <level>',
      'Appium server log level: debug | info | warn | error, or ' +
        'console:file (e.g. warn:debug) (default: info)',
    )
    .option(
      '--use-drivers <name...>',
      'restrict which installed Appium drivers to activate (default: all)',
    )
    .option(
      '--use-plugins <name...>',
      'Appium plugins to activate (default: none; e.g. images, element-wait)',
    )
    .option(
      '--address <host>',
      'interface for the spawned server to bind. Defaults to 127.0.0.1 ' +
        '(local-only); set to 0.0.0.0 or a specific IP to expose it on a ' +
        'trusted network',
    )
    .option(
      '--keep-alive-timeout <seconds>',
      'Appium HTTP keep-alive/connection timeout in seconds; 0 disables ' +
        '(default: 600)',
      (v) => Number.parseInt(v, 10),
    )
    .option(
      '--request-timeout <seconds>',
      'Appium timeout in seconds for receiving the full HTTP request; ' +
        '0 disables (default: 3600)',
      (v) => Number.parseInt(v, 10),
    )
    .option(
      '--shutdown-timeout <ms>',
      'Appium grace period in milliseconds for active connections to close ' +
        'on shutdown (default: 5000)',
      (v) => Number.parseInt(v, 10),
    )
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
      // Remote mode owns no local process, so it already behaves like --detach
      // (create session, print envelope, exit). Skip the re-exec path for it.
      if (opts.detach && !opts.serverUrl) {
        await detachAndExit(opts.sessionTimeout);
        return;
      }

      const platform = opts.platform.toLowerCase() as Platform;
      if (platform !== 'ios' && platform !== 'android') {
        throw new Error(
          `--platform must be "ios" or "android" (got "${opts.platform}")`,
        );
      }

      // When no explicit target (--udid/--avd) is given, prefer a connected
      // real device over spinning up a virtual one. Only when none is connected
      // do we fall back to auto-booting the first AVD (Android) -- Appium will
      // not auto-boot an emulator unless we tell it which AVD to use.
      // Skipped entirely with --caps-json: the user supplies the full caps, so
      // there is no aco-built target to auto-detect.
      let avd = opts.avd;
      let udid = opts.udid;
      if (!opts.capsJson && !udid && !avd) {
        const realList =
          platform === 'ios'
            ? await listIosRealDevices()
            : await listAndroidRealDevices();
        const realDevice = realList.devices.find(
          (d) => d.kind === 'real' && d.state === 'booted',
        );
        if (realDevice) {
          udid = realDevice.id;
          process.stderr.write(
            `aco: no --udid/--avd given, targeting connected real device ${udid} ` +
              `(${realDevice.name})\n`,
          );
        } else if (platform === 'android') {
          const { devices } = await listAndroidAvds();
          const first = devices[0];
          if (!first) {
            throw new Error(
              'aco: no connected Android device and no AVD found to boot. ' +
                'Plug in a device (enable USB debugging), create an AVD in Android ' +
                'Studio, or boot an emulator and pass `--udid`. ' +
                'See `aco device list --platform android`.',
            );
          }
          avd = first.name;
          process.stderr.write(`aco: no --avd given, using "${avd}"\n`);
        }
        // iOS with no real device and no flags: leave both unset. XCUITest will
        // pick a default simulator (or error) as it does today -- we do not
        // auto-pick a simulator here.
      }

      let capabilities: Record<string, unknown>;
      if (opts.capsJson) {
        // Escape hatch: use the supplied JSON verbatim as the capabilities map,
        // with --cap entries shallow-merged on top. aco's per-device caps are
        // not built, so the per-device flags below have no effect -- warn so a
        // stale flag in a script does not read as "applied".
        const ignored = [
          opts.app !== undefined ? '--app' : undefined,
          opts.appActivity !== undefined ? '--app-activity' : undefined,
          opts.deviceName !== undefined ? '--device-name' : undefined,
          opts.platformVersion !== undefined ? '--platform-version' : undefined,
          opts.udid !== undefined ? '--udid' : undefined,
          opts.avd !== undefined ? '--avd' : undefined,
          opts.xcodeOrgId !== undefined ? '--xcode-org-id' : undefined,
          opts.xcodeSigningId !== undefined ? '--xcode-signing-id' : undefined,
          opts.allowProvisioningDeviceRegistration
            ? '--allow-provisioning-device-registration'
            : undefined,
          opts.updatedWdaBundleId !== undefined
            ? '--updated-wda-bundle-id'
            : undefined,
        ].filter((f): f is string => f !== undefined);
        if (ignored.length > 0) {
          process.stderr.write(
            `aco: warning -- ignoring per-device flags with --caps-json: ${ignored.join(', ')}\n`,
          );
        }
        capabilities = {
          ...parseCapsJson(opts.capsJson),
          ...parseExtraCaps(opts.cap),
        };
      } else {
        capabilities = buildCapabilities({
          platform,
          app: opts.app,
          appActivity: opts.appActivity,
          deviceName: opts.deviceName,
          platformVersion: opts.platformVersion,
          udid,
          avd,
          xcodeOrgId: opts.xcodeOrgId,
          xcodeSigningId: opts.xcodeSigningId,
          allowProvisioningDeviceRegistration:
            opts.allowProvisioningDeviceRegistration,
          updatedWdaBundleId: opts.updatedWdaBundleId,
          extraCaps: parseExtraCaps(opts.cap),
        });
      }

      const auth = resolveAuth(opts);

      // Resolve the connection target. Reuse the same URL parsing as
      // parseConnection for the remote case so https/port/base-path are handled
      // identically to the consumer commands.
      let conn: {
        hostname: string;
        port: number;
        basePath: string;
        protocol: 'http' | 'https';
        serverUrl: string;
      };
      let server: Awaited<ReturnType<typeof startAppiumServer>> | undefined;

      if (opts.serverUrl) {
        // REMOTE: do not spawn appium.
        let url: URL;
        try {
          url = new URL(opts.serverUrl);
        } catch {
          throw new Error(`--server-url is not a valid URL: ${opts.serverUrl}`);
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error(`--server-url must use http(s); got ${url.protocol}`);
        }
        const basePath =
          url.pathname && url.pathname !== '/' ? url.pathname : '/';
        const baseSuffix = basePath.replace(/\/+$/, '');
        const protocol = url.protocol === 'https:' ? 'https' : 'http';
        conn = {
          hostname: url.hostname,
          port:
            Number.parseInt(url.port, 10) || (protocol === 'https' ? 443 : 80),
          basePath,
          protocol,
          // Canonical URL stored in the record; consumers parse it back. No creds.
          serverUrl: `${protocol}://${url.host}${baseSuffix}`,
        };

        const ignoredFlags = [
          opts.address !== undefined ? '--address' : undefined,
          opts.logLevel !== undefined ? '--log-level' : undefined,
          opts.useDrivers !== undefined ? '--use-drivers' : undefined,
          opts.usePlugins !== undefined ? '--use-plugins' : undefined,
          opts.keepAliveTimeout !== undefined
            ? '--keep-alive-timeout'
            : undefined,
          opts.requestTimeout !== undefined ? '--request-timeout' : undefined,
          opts.shutdownTimeout !== undefined ? '--shutdown-timeout' : undefined,
          opts.basePath !== undefined ? '--base-path' : undefined,
          opts.allowInsecure !== undefined ? '--allow-insecure' : undefined,
          opts.denyInsecure !== undefined ? '--deny-insecure' : undefined,
          opts.relaxedSecurity ? '--relaxed-security' : undefined,
          opts.allowCors ? '--allow-cors' : undefined,
          opts.log ? '--log' : undefined,
        ].filter((f): f is string => f !== undefined);
        if (ignoredFlags.length > 0) {
          process.stderr.write(
            `aco: warning -- ignoring local-server flags with --server-url: ${ignoredFlags.join(', ')}\n`,
          );
        }
        if (opts.detach) {
          process.stderr.write(
            'aco: --detach is a no-op with --server-url (remote sessions ' +
              'already exit immediately after creation)\n',
          );
        }
      } else {
        // LOCAL (unchanged):
        const port = await pickFreePort(opts.port);
        server = await startAppiumServer({
          port,
          tee: Boolean(opts.log),
          // --address forwards to the existing internal `hostname` option, which
          // keeps its 127.0.0.1 default when --address is omitted.
          hostname: opts.address,
          allowInsecure: opts.allowInsecure,
          denyInsecure: opts.denyInsecure,
          relaxedSecurity: opts.relaxedSecurity,
          allowCors: opts.allowCors,
          basePath: opts.basePath,
          logLevel: opts.logLevel,
          useDrivers: opts.useDrivers,
          usePlugins: opts.usePlugins,
          keepAliveTimeout: opts.keepAliveTimeout,
          requestTimeout: opts.requestTimeout,
          shutdownTimeout: opts.shutdownTimeout,
        });
        conn = {
          hostname: server.hostname,
          port: server.port,
          basePath: server.basePath,
          protocol: 'http',
          serverUrl: server.serverUrl,
        };
      }

      let browser: WebdriverIO.Browser;
      try {
        browser = await createBrowser({
          hostname: conn.hostname,
          port: conn.port,
          basePath: conn.basePath,
          protocol: conn.protocol,
          user: auth.user,
          key: auth.key,
          capabilities,
          connectionTimeoutMs: opts.sessionTimeout * 1000,
        });
      } catch (err) {
        if (server) {
          try {
            process.kill(server.pid, 'SIGTERM');
          } catch {
            /* ignore */
          }
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (
          platform === 'android' &&
          !udid &&
          /Could not find a connected Android device/i.test(msg)
        ) {
          process.stderr.write(
            `aco: hint -- the AVD "${avd}" did not come up in time. Bump --session-timeout for a cold boot, pick another AVD with --avd <name> (see "aco device list --platform android"), or boot an emulator yourself before running "session start".\n`,
          );
        }
        if (
          platform === 'ios' &&
          udid &&
          !opts.xcodeOrgId &&
          /(provisioning profile|code sign|xcodebuild|WebDriverAgent)/i.test(
            msg,
          )
        ) {
          process.stderr.write(
            'aco: hint -- building WebDriverAgent on a real iOS device needs code ' +
              'signing. Pass --xcode-org-id <TeamID> (and optionally ' +
              '--xcode-signing-id / --allow-provisioning-device-registration / ' +
              '--updated-wda-bundle-id), or open WebDriverAgent.xcodeproj in Xcode once ' +
              'to configure signing.\n',
          );
        }
        throw err;
      }

      const record: SessionRecord = {
        sessionId: browser.sessionId,
        serverUrl: conn.serverUrl,
        platform,
        // 0 => no local child; stop.ts/list.ts already treat this as "remote".
        pid: server?.pid ?? 0,
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

      if (!server) {
        // REMOTE: nothing local to babysit. The session lives on the farm; we
        // exit cleanly and let `aco <command>` attach and `aco session stop`
        // tear it down.
        process.stderr.write(
          'session created on remote server -- stop it with `aco session stop`\n',
        );
        return;
      }

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
