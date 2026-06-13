import type { Command } from '@commander-js/extra-typings';
import {
  type SessionRecord,
  latestLiveSession,
  readSession,
} from './session-store.js';

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
  session?: string;
  serverUrl?: string;
  platform?: string;
}

export function parseConnection(flags: ConnectionFlags): Connection {
  if (!flags.session) throw new Error('--session is required');
  if (!flags.platform) throw new Error('--platform is required');

  const platform = flags.platform.toLowerCase();
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
    .option(
      '-s, --session <id>',
      'W3C session id (defaults to the latest live session in ~/.aco/sessions)',
    )
    .option(
      '-S, --server-url <url>',
      `Appium server URL (defaults to the stored session's URL, then ${DEFAULT_SERVER_URL})`,
    )
    .option(
      '-p, --platform <ios|android>',
      "session platform (drives mobile: dispatch; defaults to the stored session's platform)",
    );
}

export interface ResolveResult {
  conn: Connection;
  source: 'flags' | 'store-by-id' | 'store-latest';
  record?: SessionRecord;
}

export function resolveConnection(flags: ConnectionFlags): ResolveResult {
  if (flags.session && flags.serverUrl && flags.platform) {
    return { conn: parseConnection(flags), source: 'flags' };
  }

  if (flags.session) {
    const rec = readSession(flags.session);
    const serverUrl = flags.serverUrl ?? rec?.serverUrl ?? DEFAULT_SERVER_URL;
    const platform = flags.platform ?? rec?.platform;
    if (!rec && !flags.serverUrl) {
      process.stderr.write(
        `aco: warning -- no stored record for session ${flags.session}; ` +
          `falling back to ${DEFAULT_SERVER_URL}\n`,
      );
    }
    if (!platform) {
      throw new Error(
        `--platform is required (no stored record found for session ${flags.session})`,
      );
    }
    return {
      conn: parseConnection({ session: flags.session, serverUrl, platform }),
      source: rec ? 'store-by-id' : 'flags',
      record: rec ?? undefined,
    };
  }

  const latest = latestLiveSession();
  if (!latest) {
    throw new Error(
      'no --session given and no live session found in ~/.aco/sessions. ' +
        'Start one with `aco session start ...` or pass --session explicitly.',
    );
  }
  return {
    conn: parseConnection({
      session: latest.sessionId,
      serverUrl: flags.serverUrl ?? latest.serverUrl,
      platform: flags.platform ?? latest.platform,
    }),
    source: 'store-latest',
    record: latest,
  };
}
