import { attach, remote } from 'webdriverio';
import type { Connection } from './connection.js';

// Node >=26 enforces the Fetch spec's "forbidden request headers" and rejects
// any request that sets them by hand. webdriver@9's transport does exactly
// that: its DEFAULT_HEADERS carry `Connection: keep-alive` and it computes a
// `Content-Length` header for every request with a body. The result is that
// *every* WebDriver call fails on Node 26 with
//   WebDriverError: Request failed with error code UND_ERR_INVALID_ARG
// even though the identical code works on Node <=25 (which silently dropped the
// forbidden headers). This is webdriverio#15265; until it ships a fix upstream
// we strip the offending headers via the supported `transformRequest` hook. The
// Fetch layer recomputes Content-Length from the body and manages connection
// reuse itself, so removing them is safe -- and on Node <=25 deleting
// absent/allowed headers is a harmless no-op.
export function stripForbiddenHeaders(
  requestOptions: RequestInit,
): RequestInit {
  const { headers } = requestOptions;
  if (headers instanceof Headers) {
    headers.delete('Connection');
    headers.delete('Content-Length');
  }
  return requestOptions;
}

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
    transformRequest: stripForbiddenHeaders,
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
    transformRequest: stripForbiddenHeaders,
    // Only forwarded when set; undefined user/key means no auth header.
    ...(opts.user !== undefined ? { user: opts.user } : {}),
    ...(opts.key !== undefined ? { key: opts.key } : {}),
    capabilities: opts.capabilities as WebdriverIO.Capabilities,
  });
}
