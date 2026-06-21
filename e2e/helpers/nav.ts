import { TestIDs } from '../../aut/src/testids.js';
import { acoOk } from './aco.js';
import { findId } from './find.js';
import { APP_IDENTIFIER, isIOS } from './platform.js';

// Reset to Home by relaunching the app process. There is no aco "back"
// command and the nav-bar back button has no testID, so the only reliable
// reset is to terminate + activate the app, which lands it on `/` with fresh
// React state (research.md §6.9). The param key differs per driver: xcuitest
// takes `bundleId`, uiautomator2 takes `appId` -- a single hardcoded key would
// silently no-op on the other driver (Appium drops unknown keys).
export function resetApp(): void {
  const args = isIOS ? { bundleId: APP_IDENTIFIER } : { appId: APP_IDENTIFIER };
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
  // Native paints its tree -- on Android `source`/`find` right after sees the
  // bare native shell and the testIDs are absent (a flaky render race). Block
  // until the Home title is actually displayed so callers land on a rendered
  // Home every time.
  acoOk([
    'wait',
    '--using',
    'accessibility id',
    '--value',
    TestIDs.home.title,
    '--for',
    'displayed',
    '--timeout',
    '30000',
  ]);
}

// Tap a Home <Link> to navigate into its screen.
export function navTo(homeLinkTestId: string): void {
  acoOk(['element', 'click', '--element', findId(homeLinkTestId)]);
}

export function resetToElements(): void {
  resetApp();
  navTo(TestIDs.home.navElements);
}

export function resetToKeyboard(): void {
  resetApp();
  navTo(TestIDs.home.navKeyboard);
}

export function resetToGestures(): void {
  resetApp();
  navTo(TestIDs.home.navGestures);
}

export function resetToWebview(): void {
  resetApp();
  navTo(TestIDs.home.navWebview);
}
