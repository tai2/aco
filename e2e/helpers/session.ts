import { acoOk, runAco } from './aco.js';
import { PLATFORM, appArtefact } from './platform.js';
import { preflight } from './preflight.js';

export interface StartedSession {
  sessionId: string;
  serverUrl: string;
}

export function startSession(): StartedSession {
  preflight();
  const args = [
    'session',
    'start',
    '--detach',
    '--platform',
    PLATFORM,
    '--app',
    appArtefact(),
    // Cold WDA / UiAutomator2 boots are slow; allow up to 5 minutes.
    '--session-timeout',
    '300',
  ];
  if (PLATFORM === 'ios' && process.env.ACO_E2E_DEVICE_NAME) {
    args.push('--device-name', process.env.ACO_E2E_DEVICE_NAME);
  }
  if (PLATFORM === 'android' && process.env.ACO_E2E_AVD) {
    args.push('--avd', process.env.ACO_E2E_AVD);
  }
  const r = acoOk(args);
  // `session start --detach` prints exactly one JSON envelope line on stdout.
  return JSON.parse(r.stdout.trim()) as StartedSession;
}

export function stopAllSessions(): void {
  // Tolerate "no sessions" -- `session stop --all` is idempotent.
  runAco(['session', 'stop', '--all']);
}
