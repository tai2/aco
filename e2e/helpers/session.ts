import { acoOk, runAco } from './aco.js';
import { PLATFORM, appArtefact } from './platform.js';
import { preflight } from './preflight.js';

export interface StartedSession {
  sessionId: string;
  serverUrl: string;
}

// Cold WDA / UiAutomator2 boots are slow; allow up to 5 minutes for session
// creation. Every wall-clock budget above this must strictly exceed it, or it
// gets silently truncated: the detached child waits SESSION_TIMEOUT_SEC + 60s
// for the envelope, so the spawnSync below must outlast that, and the vitest
// beforeAll hook (420_000ms) must outlast the spawnSync.
const SESSION_TIMEOUT_SEC = 300;
const SESSION_START_TIMEOUT_MS = (SESSION_TIMEOUT_SEC + 90) * 1000;

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
    '--session-timeout',
    String(SESSION_TIMEOUT_SEC),
  ];
  if (PLATFORM === 'ios' && process.env.ACO_E2E_DEVICE_NAME) {
    args.push('--device-name', process.env.ACO_E2E_DEVICE_NAME);
  }
  if (PLATFORM === 'android' && process.env.ACO_E2E_AVD) {
    args.push('--avd', process.env.ACO_E2E_AVD);
  }
  if (PLATFORM === 'android') {
    // Let the uiautomator2 driver fetch a Chromedriver matching the device's
    // system WebView so `context switch` into the WEBVIEW_* context works.
    // Appium 3 requires insecure features to be scoped to a driver (or '*').
    args.push('--allow-insecure', 'uiautomator2:chromedriver_autodownload');
  }
  const r = acoOk(args, { timeoutMs: SESSION_START_TIMEOUT_MS });
  // `session start --detach` prints exactly one JSON envelope line on stdout.
  return JSON.parse(r.stdout.trim()) as StartedSession;
}

export function stopAllSessions(): void {
  // Tolerate "no sessions" -- `session stop --all` is idempotent.
  runAco(['session', 'stop', '--all']);
}
