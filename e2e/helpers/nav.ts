import { TestIDs } from '../../aut/src/testids.js';
import { acoOk } from './aco.js';
import { findId } from './find.js';
import { APP_IDENTIFIER, isIOS } from './platform.js';
import { withRetry } from './retry.js';

// Block until `testId` reaches `state` (mirrors the states `aco wait` exposes).
// Use 'exists' (element present in the tree) for screen anchors that may be
// non-visible container Views -- 'displayed' false-negatives on those.
function waitFor(testId: string, state: 'displayed' | 'exists'): void {
  acoOk([
    'wait',
    '--using',
    'accessibility id',
    '--value',
    testId,
    '--for',
    state,
    '--timeout',
    '30000',
  ]);
}

// Reset to Home by relaunching the app process. There is no aco "back"
// command and the nav-bar back button has no testID, so the only reliable
// reset is to terminate + activate the app, which lands it on `/` with fresh
// React state (research.md §6.9). The param key differs per driver: xcuitest
// takes `bundleId`, uiautomator2 takes `appId` -- a single hardcoded key would
// silently no-op on the other driver (Appium drops unknown keys).
//
// The whole sequence is wrapped in withRetry because activateApp intermittently
// fails on CI with XCTDaemon "Timed out attempting to launch app" -- a WDA
// launch flake, not a product bug. Re-terminating first means a half-launched
// app from the timed-out attempt is cleaned up before we retry the activate.
export function resetApp(): void {
  const args = isIOS ? { bundleId: APP_IDENTIFIER } : { appId: APP_IDENTIFIER };
  withRetry(() => {
    acoOk([
      'mobile',
      'call',
      '--name',
      'mobile: terminateApp',
      '--args',
      JSON.stringify(args),
    ]);
    acoOk([
      'mobile',
      'call',
      '--name',
      'mobile: activateApp',
      '--args',
      JSON.stringify(args),
    ]);
    // activateApp returns as soon as the activity is foregrounded, before React
    // Native paints its tree -- a `source`/`find` right after sees the bare
    // native shell and the testIDs are absent (a flaky render race). Block until
    // the Home title is actually displayed so callers land on a rendered Home
    // every time.
    waitFor(TestIDs.home.title, 'displayed');
  });
}

// Tap a Home <Link> to navigate into its screen, then block until a known
// anchor of the destination screen is present. The click triggers a slide
// transition; querying the destination before it mounts flakes with "element
// could not be located" (the same render race resetApp guards against on Home).
// We wait for 'exists' rather than 'displayed' because some screen anchors are
// container Views the driver never reports as visible -- presence in the tree
// is what the subsequent `find` actually needs.
export function navTo(homeLinkTestId: string, expectTestId: string): void {
  acoOk(['element', 'click', '--element', findId(homeLinkTestId)]);
  waitFor(expectTestId, 'exists');
}

export function resetToElements(): void {
  resetApp();
  navTo(TestIDs.home.navElements, TestIDs.elements.container);
}

export function resetToKeyboard(): void {
  resetApp();
  navTo(TestIDs.home.navKeyboard, TestIDs.kb.container);
}

export function resetToGestures(): void {
  resetApp();
  navTo(TestIDs.home.navGestures, TestIDs.gestures.target);
}

export function resetToWebview(): void {
  resetApp();
  navTo(TestIDs.home.navWebview, TestIDs.webview.container);
}
