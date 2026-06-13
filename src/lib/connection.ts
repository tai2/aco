import type { Command } from '@commander-js/extra-typings';

export type Platform = 'ios' | 'android';

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:4723';

export interface Connection {
  sessionId: string;
  hostname: string;
  port: number;
  basePath: string;
  protocol: 'http' | 'https';
  platform: Platform;
}

export interface ConnectionFlags {
  session: string;
  serverUrl?: string;
  platform: string;
}

export function parseConnection(flags: ConnectionFlags): Connection {
  if (!flags.session) throw new Error('--session is required');

  const platform = flags.platform?.toLowerCase();
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(
      `--platform must be "ios" or "android" (got "${flags.platform}")`,
    );
  }

  const rawUrl = flags.serverUrl ?? DEFAULT_SERVER_URL;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`--server-url is not a valid URL: ${rawUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`--server-url must use http(s); got ${url.protocol}`);
  }

  return {
    sessionId: flags.session,
    hostname: url.hostname,
    port:
      Number.parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80),
    basePath: url.pathname && url.pathname !== '/' ? url.pathname : '/',
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    platform,
  };
}

export function addConnectionFlags(cmd: Command) {
  return cmd
    .requiredOption('-s, --session <id>', 'W3C session id')
    .option('-S, --server-url <url>', 'Appium server URL', DEFAULT_SERVER_URL)
    .requiredOption(
      '-p, --platform <ios|android>',
      'session platform (drives mobile: dispatch)',
    );
}
