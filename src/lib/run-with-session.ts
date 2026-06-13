import {
  type ConnectionFlags,
  type Platform,
  resolveConnection,
} from './connection.js';
import { attachBrowser } from './wd-client.js';

export async function runWithSession<T>(
  flags: ConnectionFlags,
  fn: (b: WebdriverIO.Browser, platform: Platform) => Promise<T>,
): Promise<T> {
  const { conn } = resolveConnection(flags);
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
