import { attachBrowser } from './wd-client.js';
import { parseConnection, type ConnectionFlags, type Platform } from './connection.js';

export async function runWithSession<T>(
  flags: ConnectionFlags,
  fn: (b: WebdriverIO.Browser, platform: Platform) => Promise<T>,
): Promise<T> {
  const conn = parseConnection(flags);
  const browser = await attachBrowser(conn);
  try {
    return await fn(browser, conn.platform);
  } finally {
    try {
      await (browser as { shutdown?: () => Promise<void> }).shutdown?.();
    } catch {
      /* ignore */
    }
  }
}
