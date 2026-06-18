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
  hostname?: string;
  tee?: boolean;
  // Appium "insecure features" to enable on the server (e.g.
  // `chromedriver_autodownload`). Forwarded verbatim as --allow-insecure.
  allowInsecure?: string[];
}

export async function startAppiumServer(
  opts: StartAppiumServerOptions,
): Promise<StartedServer> {
  const hostname = opts.hostname ?? '127.0.0.1';
  const basePath = '/';

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
    'info',
  ];
  if (opts.allowInsecure && opts.allowInsecure.length > 0) {
    args.push('--allow-insecure', opts.allowInsecure.join(','));
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

  const serverUrl = `http://${hostname}:${opts.port}`;
  await waitForReady(serverUrl, 30_000);

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
  serverUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${serverUrl}/status`);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await delay(250);
  }
  throw new Error(
    `Appium server did not become ready within ${timeoutMs}ms at ${serverUrl}. ` +
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
