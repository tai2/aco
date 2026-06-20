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

interface ListedSession extends StartedSession {
  alive: boolean | null;
}

// Resolve a session that is still live, if one exists. Building/launching WDA
// is the slow, flaky part of an iOS run, so the suite shares ONE session across
// all specs (vitest.e2e.config.ts: "one simulator, one session"): the first
// spec's beforeAll starts it, every later beforeAll resolves and reuses it, and
// the global teardown (helpers/teardown.ts) stops it once at the very end.
function resolveLiveSession(): StartedSession | undefined {
  const r = runAco(['session', 'list', '--json']);
  if (r.status !== 0) return undefined;
  let records: ListedSession[];
  try {
    records = JSON.parse(r.stdout) as ListedSession[];
  } catch {
    return undefined;
  }
  // `alive` is true (server reachable) or null (couldn't probe but pid is up);
  // only `false` means definitively dead.
  const live = records.find((rec) => rec.alive !== false);
  return live && { sessionId: live.sessionId, serverUrl: live.serverUrl };
}

export function startSession(): StartedSession {
  const existing = resolveLiveSession();
  if (existing) return existing;

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
  if (PLATFORM === 'ios' && process.env.ACO_E2E_UDID) {
    // Target the exact simulator CI already booted. Without a udid the xcuitest
    // driver matches on deviceName alone and may pick (and cold-boot) a
    // different "iPhone 16 Pro" from another runtime, which is slow and a
    // frequent source of WDA-launch flake.
    args.push('--udid', process.env.ACO_E2E_UDID);
  }
  if (PLATFORM === 'ios' && process.env.ACO_E2E_DEVICE_NAME) {
    args.push('--device-name', process.env.ACO_E2E_DEVICE_NAME);
  }
  if (PLATFORM === 'ios') {
    // Even with WDA pre-built (no compile), the first session still has to wait
    // for the WDA runner to boot and start serving on :8100 -- a burst of
    // `connect ECONNREFUSED 127.0.0.1:8100` until it's up. On a slow CI runner
    // that boot is the long pole, and the default 60s wdaLaunchTimeout (plus its
    // kill-and-retry) expires before WDA is ready. Give one launch attempt a
    // generous window, kept under SESSION_TIMEOUT_SEC (300s) so createBrowser
    // and the budgets above it still bound the whole start.
    args.push('--cap', 'appium:wdaLaunchTimeout=240000');
    if (process.env.ACO_E2E_PREBUILT_WDA) {
      // CI compiles WDA up front (workflow "Pre-build WebDriverAgent" step).
      // Without this the driver still re-runs xcodebuild inside the session,
      // and a cold compile blows past the create deadline. Skip the build and
      // launch the prebuilt WDA from its (shared) DerivedData. Not set locally,
      // where there is no pre-build step and DerivedData may be empty.
      args.push('--cap', 'appium:usePrebuiltWDA=true');
    }
  }
  if (PLATFORM === 'android' && process.env.ACO_E2E_AVD) {
    args.push('--avd', process.env.ACO_E2E_AVD);
  }
  if (PLATFORM === 'android') {
    // Force the device into English (US) for the session. The on-screen IME
    // follows the system language; on a Japanese-locale emulator a romaji
    // keyboard composes typed letters into kana ("hi" -> "ひ") and renders
    // digits full-width ("42" -> "４２"), which breaks `actions --type`
    // round-trips. uiautomator2's language/locale caps set this at session
    // start and restore the original on teardown.
    args.push('--cap', 'appium:language=en');
    args.push('--cap', 'appium:locale=US');
    // Let the uiautomator2 driver fetch a Chromedriver matching the device's
    // system WebView so `context switch` into the WEBVIEW_* context works.
    // Appium 3 requires insecure features to be scoped to a driver (or '*').
    args.push('--allow-insecure', 'uiautomator2:chromedriver_autodownload');
  }
  const r = acoOk(args, { timeoutMs: SESSION_START_TIMEOUT_MS });
  // `session start --detach` prints exactly one JSON envelope line on stdout.
  return JSON.parse(r.stdout.trim()) as StartedSession;
}

// Tear down the shared session. Called once by the global teardown after the
// whole suite -- NOT per spec, or the next spec would have to relaunch WDA.
export function stopAllSessions(): void {
  // Tolerate "no sessions" -- `session stop --all` is idempotent.
  runAco(['session', 'stop', '--all']);
}
