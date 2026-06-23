import { attach, remote } from 'webdriverio';
import type { Connection } from './connection.js';

export async function attachBrowser(
  conn: Connection,
): Promise<WebdriverIO.Browser> {
  return attach({
    sessionId: conn.sessionId,
    capabilities: {} as WebdriverIO.Capabilities,
    hostname: conn.hostname,
    port: conn.port,
    path: conn.basePath,
    protocol: conn.protocol,
    isMobile: true,
    isIOS: conn.platform === 'ios',
    isAndroid: conn.platform === 'android',
    logLevel: 'silent',
  });
}

export const DEFAULT_SESSION_TIMEOUT_MS = 300_000;

export interface CreateBrowserOptions {
  hostname: string;
  port: number;
  basePath: string;
  capabilities: Record<string, unknown>;
  connectionTimeoutMs?: number;
  // Remote-server support:
  protocol?: 'http' | 'https'; // defaults to 'http'
  // BASIC auth -- webdriver's transport (webdriver@9.27.2 build/node.js ~line
  // 2147) attaches `Authorization: Basic base64(user:key)` ONLY to the
  // `POST /session` request, never to subsequent commands. This matches the
  // device-farm contract where only session creation requires auth.
  user?: string;
  key?: string;
}

export async function createBrowser(
  opts: CreateBrowserOptions,
): Promise<WebdriverIO.Browser> {
  return remote({
    hostname: opts.hostname,
    port: opts.port,
    path: opts.basePath,
    protocol: opts.protocol ?? 'http',
    logLevel: 'silent',
    connectionRetryTimeout:
      opts.connectionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
    connectionRetryCount: 0,
    // Only forwarded when set; undefined user/key means no auth header.
    ...(opts.user !== undefined ? { user: opts.user } : {}),
    ...(opts.key !== undefined ? { key: opts.key } : {}),
    capabilities: opts.capabilities as WebdriverIO.Capabilities,
  });
}
