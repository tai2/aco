import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAco } from './helpers/aco.js';
import { PLATFORM } from './helpers/platform.js';
import {
  type StartedSession,
  startSession,
  stopAllSessions,
} from './helpers/session.js';

let session: StartedSession;

beforeAll(() => {
  session = startSession();
}, 420_000);
afterAll(() => {
  stopAllSessions();
});

describe('smoke: session lifecycle + snapshot/discovery commands', () => {
  it('session start wrote a live record that session list resolves', () => {
    const r = runAco(['session', 'list', '--json']);
    expect(r.status).toBe(0);
    const records = JSON.parse(r.stdout) as Array<{
      sessionId: string;
      alive: boolean | null;
    }>;
    const ours = records.find((rec) => rec.sessionId === session.sessionId);
    expect(ours).toBeDefined();
    expect(ours?.alive).not.toBe(false);
  });

  it('mobile list --versions reports the pinned driver(s) for this platform', () => {
    const r = runAco(['mobile', 'list', '--platform', PLATFORM, '--versions']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/@\d+\.\d+\.\d+ \(\d+ entries\)/);
  });

  it('device list returns a devices array for this platform', () => {
    const r = runAco(['device', 'list', '--platform', PLATFORM, '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      devices: unknown[];
      notes: string[];
    };
    expect(Array.isArray(parsed.devices)).toBe(true);
  });
});
