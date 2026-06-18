import { spawnSync } from 'node:child_process';
import { isIOS } from './platform.js';
import { stopAllSessions } from './session.js';

// Reap leftover Appium servers / WDA from a run that was killed before its
// teardown. `session stop --all` only reaps sessions still recorded in the
// store; a killed run leaves the record gone but its detached Appium child --
// and the WebDriverAgent process *inside the simulator* (listening on :8100) --
// still alive. A fresh session on the same simulator then collides with the
// orphan ("... is already in use by another session ... Terminating the
// obsolete session"), which tears WDA down mid-handshake and surfaces as
// UND_ERR_SOCKET / ECONNREFUSED 127.0.0.1:8100 on POST /session.
function reapOrphans(): void {
  // Cleanly release anything still in the store first (deleteSession frees the
  // device claim that the cruder kills below would otherwise strand).
  stopAllSessions();

  // Stray Appium servers whose records are already gone. rc!=0 (nothing to
  // kill) is fine; this never matches the vitest worker (its argv has no
  // "appium").
  spawnSync('pkill', ['-if', 'appium'], { timeout: 10_000 });

  // WDA keeps its :8100 listener alive inside the simulator after its server
  // dies; terminate it on every booted device so the next session starts clean.
  if (isIOS) {
    spawnSync(
      'xcrun',
      [
        'simctl',
        'terminate',
        'booted',
        'com.facebook.WebDriverAgentRunner.xctrunner',
      ],
      { timeout: 30_000 },
    );
  }
}

// vitest globalSetup: the e2e suite shares one Appium session / WDA launch
// across every spec (see session.ts). Start from a clean device, and tear the
// shared session down exactly once after all specs have run.
export function setup(): void {
  reapOrphans();
}

export function teardown(): void {
  reapOrphans();
}
