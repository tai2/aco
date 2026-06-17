import { existsSync } from 'node:fs';

export type Platform = 'ios' | 'android';

export const PLATFORM: Platform = (() => {
  const p = process.env.ACO_E2E_PLATFORM;
  if (p !== 'ios' && p !== 'android') {
    throw new Error(
      'ACO_E2E_PLATFORM must be "ios" or "android" to run the e2e suite',
    );
  }
  return p;
})();

export const isIOS = PLATFORM === 'ios';
export const isAndroid = PLATFORM === 'android';

export function appArtefact(): string {
  const v = isIOS
    ? process.env.ACO_AUT_IOS_APP
    : process.env.ACO_AUT_ANDROID_APK;
  if (!v) {
    throw new Error(
      `set ${isIOS ? 'ACO_AUT_IOS_APP' : 'ACO_AUT_ANDROID_APK'} to the built artefact path`,
    );
  }
  if (!existsSync(v)) throw new Error(`AUT artefact not found at ${v}`);
  return v;
}

// The AUT's app identifier (aut/app.json -- research.md §3.1). The mobile:
// terminateApp / activateApp param key differs per driver: xcuitest takes
// `bundleId`, uiautomator2 takes `appId`.
export const APP_IDENTIFIER = 'net.tai2.aco.aut';

// Per-platform expected values for find-strategy / class-name assertions.
export const expected = {
  staticTextClass: isIOS
    ? 'XCUIElementTypeStaticText'
    : 'android.widget.TextView',
  // The XML attribute that carries the accessibility id differs per driver
  // (research.md §8.3): XCUITest exposes `name`, UiAutomator2 `content-desc`.
  xpathAttr: isIOS ? 'name' : 'content-desc',
} as const;
