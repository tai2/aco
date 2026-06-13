import type { Command } from '@commander-js/extra-typings';
import { stopAppiumServer } from '../../lib/appium-server.js';
import type { Connection } from '../../lib/connection.js';
import {
  type SessionRecord,
  latestLiveSession,
  listSessions,
  readSession,
  removeSession,
} from '../../lib/session-store.js';
import { attachBrowser } from '../../lib/wd-client.js';

function resolveStopTargets(opts: {
  all?: boolean;
  session?: string;
}): SessionRecord[] {
  if (opts.all) return listSessions();
  const id = opts.session ?? latestLiveSession()?.sessionId;
  if (!id) {
    throw new Error('no --session and no stored session to stop');
  }
  const rec = readSession(id);
  if (!rec) throw new Error(`no stored session ${id}`);
  return [rec];
}

function connectionFromRecord(r: SessionRecord): Connection {
  const url = new URL(r.serverUrl);
  return {
    sessionId: r.sessionId,
    hostname: url.hostname,
    port:
      Number.parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80),
    basePath: url.pathname && url.pathname !== '/' ? url.pathname : '/',
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    platform: r.platform,
  };
}

export function registerSessionStop(session: Command): void {
  session
    .command('stop')
    .description(
      'tear down a stored session (deleteSession + SIGTERM the Appium child) and remove its record',
    )
    .option('-s, --session <id>', 'session id (default: latest live session)')
    .option('--all', 'stop every stored session')
    .action(async (opts) => {
      const records = resolveStopTargets(opts);

      for (const r of records) {
        process.stderr.write(`aco: stopping ${r.sessionId} ...\n`);
        try {
          const browser = await attachBrowser(connectionFromRecord(r));
          await browser.deleteSession();
        } catch (err) {
          process.stderr.write(
            `aco: warning -- deleteSession failed for ${r.sessionId}: ${(err as Error).message}\n`,
          );
        }
        if (r.pid) {
          try {
            await stopAppiumServer(r.pid);
          } catch (err) {
            process.stderr.write(
              `aco: warning -- SIGTERM pid ${r.pid} failed: ${(err as Error).message}\n`,
            );
          }
        }
        removeSession(r.sessionId);
        process.stderr.write(`aco: stopped ${r.sessionId}\n`);
      }
    });
}
