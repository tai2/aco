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
}

export async function createBrowser(
  opts: CreateBrowserOptions,
): Promise<WebdriverIO.Browser> {
  return remote({
    hostname: opts.hostname,
    port: opts.port,
    path: opts.basePath,
    protocol: 'http',
    logLevel: 'silent',
    connectionRetryTimeout: opts.connectionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
    connectionRetryCount: 0,
    capabilities: opts.capabilities as WebdriverIO.Capabilities,
  });
}
