import { type ChildProcess, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export interface StartedServer {
  child: ChildProcess;
  serverUrl: string;
  hostname: string;
  port: number;
  basePath: string;
  pid: number;
}

export interface StartAppiumServerOptions {
  port: number;
  // Interface to bind (Appium --address). Defaults to "127.0.0.1" — note this
  // is deliberately narrower than Appium's own 0.0.0.0 default. Surfaced via
  // the --address CLI flag.
  hostname?: string;
  tee?: boolean;
  // Appium "insecure features" to enable on the server (e.g.
  // `chromedriver_autodownload`). Forwarded verbatim as --allow-insecure.
  allowInsecure?: string[];
  // Appium "insecure features" to disable. Only meaningful alongside
  // --allow-insecure or --relaxed-security; applied last (deny wins).
  denyInsecure?: string[];
  // Open all insecure features (Appium --relaxed-security). Use only on a
  // trusted local network; pair with --deny-insecure to claw features back.
  relaxedSecurity?: boolean;
  // Allow browser (CORS) connections to the server (Appium --allow-cors).
  allowCors?: boolean;
  // Server URL prefix for all WebDriver routes (Appium --base-path).
  // Defaults to "/".
  basePath?: string;
  // Appium server log level, e.g. "debug" or "warn:debug" (console:file).
  // Defaults to "info".
  logLevel?: string;
  // Drivers to activate (Appium --use-drivers). Default: all installed.
  useDrivers?: string[];
  // Plugins to activate (Appium --use-plugins). Default: none.
  usePlugins?: string[];
  // Appium --keep-alive-timeout, in seconds (0 disables). Default: Appium's 600.
  keepAliveTimeout?: number;
  // Appium --request-timeout, in seconds (0 disables). Default: Appium's 3600.
  requestTimeout?: number;
  // Appium --shutdown-timeout, in milliseconds. Default: Appium's 5000.
  shutdownTimeout?: number;
  // How long to wait for the spawned server to start serving /status before
  // giving up (and tearing the child down). Defaults to 30s.
  readyTimeoutMs?: number;
}

export async function startAppiumServer(
  opts: StartAppiumServerOptions,
): Promise<StartedServer> {
  const hostname = opts.hostname ?? '127.0.0.1';
  const basePath = opts.basePath ?? '/';
  const logLevel = opts.logLevel ?? 'info';

  mkdirSync(join(homedir(), '.aco', 'logs'), { recursive: true });
  const logFile = createWriteStream(
    join(homedir(), '.aco', 'logs', `appium-${opts.port}.log`),
  );

  const args = [
    '--address',
    hostname,
    '--port',
    String(opts.port),
    '--base-path',
    basePath,
    '--log-level',
    logLevel,
  ];
  if (opts.allowInsecure && opts.allowInsecure.length > 0) {
    args.push('--allow-insecure', opts.allowInsecure.join(','));
  }
  if (opts.denyInsecure && opts.denyInsecure.length > 0) {
    args.push('--deny-insecure', opts.denyInsecure.join(','));
  }
  if (opts.relaxedSecurity) {
    args.push('--relaxed-security');
  }
  if (opts.allowCors) {
    args.push('--allow-cors');
  }
  if (opts.useDrivers && opts.useDrivers.length > 0) {
    args.push('--use-drivers', opts.useDrivers.join(','));
  }
  if (opts.usePlugins && opts.usePlugins.length > 0) {
    args.push('--use-plugins', opts.usePlugins.join(','));
  }
  if (opts.keepAliveTimeout !== undefined) {
    args.push('--keep-alive-timeout', String(opts.keepAliveTimeout));
  }
  if (opts.requestTimeout !== undefined) {
    args.push('--request-timeout', String(opts.requestTimeout));
  }
  if (opts.shutdownTimeout !== undefined) {
    args.push('--shutdown-timeout', String(opts.shutdownTimeout));
  }

  const child = spawn('appium', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  child.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      process.stderr.write(
        'aco: `appium` not found on PATH. Install Appium first: ' +
          'https://appium.io/docs/en/latest/quickstart/install/\n',
      );
      process.exit(127);
    }
    throw err;
  });

  child.stdout?.pipe(logFile);
  child.stderr?.pipe(logFile);

  if (opts.tee) {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stdout);
  }

  // serverUrl carries the base-path so it is the full, canonical URL the
  // session record stores and subcommands attach to (parseConnection derives
  // basePath back out of the pathname). For the default "/" the suffix is empty.
  const baseSuffix = basePath.replace(/\/+$/, '');
  const serverUrl = `http://${hostname}:${opts.port}${baseSuffix}`;
  // Appium serves /status under --base-path, so a non-default base-path must be
  // included in the readiness probe or it 404s and we never see a 200.
  const statusUrl = `${serverUrl}/status`;
  try {
    await waitForReady(statusUrl, opts.readyTimeoutMs ?? 30_000);
  } catch (err) {
    // We spawned this child; if it never became ready we own tearing it down.
    // Without this, a never-binding Appium (e.g. one wedged before listening)
    // is left as a zombie after startAppiumServer rejects, since the caller
    // only kills the server in the createBrowser failure branch.
    if (child.pid) {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch (killErr) {
        if ((killErr as NodeJS.ErrnoException).code !== 'ESRCH') throw killErr;
      }
    }
    throw err;
  }

  return {
    child,
    serverUrl,
    hostname,
    port: opts.port,
    basePath,
    pid: child.pid ?? 0,
  };
}

async function waitForReady(
  statusUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(statusUrl);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await delay(250);
  }
  throw new Error(
    `Appium server did not become ready within ${timeoutMs}ms at ${statusUrl}. ` +
      `Last error: ${String(lastErr ?? 'n/a')}. Check ~/.aco/logs/appium-*.log for details.`,
  );
}

export async function stopAppiumServer(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err;
  }
}
