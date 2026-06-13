import type { Command } from '@commander-js/extra-typings';
import {
  isLocalHost,
  isPidAlive,
  listSessions,
  probeServerStatus,
  removeSession,
  type SessionRecord,
} from '../../lib/session-store.js';

interface AnnotatedRecord extends SessionRecord {
  alive: boolean | null;
  pidAlive: boolean | null;
  serverUp: boolean | null;
}

export function registerSessionList(session: Command): void {
  session
    .command('list')
    .description('list sessions stored under ~/.aco/sessions')
    .option('--json', 'emit JSON instead of a table')
    .option(
      '--prune',
      'delete records for sessions whose server is unreachable or whose Appium child is dead',
    )
    .action(async (opts) => {
      const records = listSessions();
      const annotated: AnnotatedRecord[] = await Promise.all(
        records.map(async (r) => {
          const pidAlive = isLocalHost(r.serverUrl) ? isPidAlive(r.pid) : null;
          const serverUp = await probeServerStatus(r.serverUrl, 2_000);
          const alive: boolean | null =
            serverUp === false
              ? false
              : pidAlive === false
                ? false
                : serverUp === true
                  ? true
                  : null;
          return { ...r, alive, pidAlive, serverUp };
        }),
      );

      if (opts.prune) {
        let n = 0;
        for (const r of annotated) {
          if (r.alive === false) {
            removeSession(r.sessionId);
            n += 1;
          }
        }
        process.stderr.write(`aco: pruned ${n} dead record(s)\n`);
        return;
      }

      if (opts.json) {
        process.stdout.write(JSON.stringify(annotated, null, 2) + '\n');
        return;
      }

      if (annotated.length === 0) {
        process.stderr.write(
          'no sessions stored. start one with `aco session start ...`\n',
        );
        return;
      }

      for (const r of annotated) {
        const alive = r.alive === null ? '?' : r.alive ? 'yes' : 'no';
        process.stdout.write(
          [
            r.startedAt,
            r.platform.padEnd(7),
            String(r.pid).padEnd(6),
            alive.padEnd(5),
            r.serverUrl.padEnd(34),
            r.sessionId,
          ].join('  ') + '\n',
        );
      }
    });
}
