import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToWebview } from './helpers/nav.js';
import { startSession, stopAllSessions } from './helpers/session.js';
import { waitForWebviewContext } from './helpers/webview.js';

// HTML element ids from the bundled page in aut/assets/webview.html. They are
// web-DOM ids (not RN testIDs), so the dot must be CSS-escaped in a selector.
const BUTTON_SELECTOR = '#webview\\.button';
const OUTPUT_SELECTOR = '#webview\\.output';

beforeAll(() => {
  startSession();
  resetToWebview();
}, 360_000);
afterAll(() => {
  stopAllSessions();
});

describe('webview context switching on /webview', () => {
  it('drives the embedded webview through a context switch and back', (ctx) => {
    let wv: string;
    try {
      wv = waitForWebviewContext();
    } catch (err) {
      // Whether a WKWebView is surfaced as a web context depends on the
      // simulator's web-inspector bridge (Xcode / iOS-runtime /
      // appium-xcuitest-driver versions) -- the most environment-fragile part
      // of the suite (research.md §6.6/§7.9). The native webview is present and
      // loads; if the bridge does not expose a WEBVIEW_* context in this
      // environment, skip rather than fail. It still runs wherever the bridge
      // works (Android, and iOS setups that surface app webviews).
      console.warn(
        `[context.e2e] skipping webview test: ${(err as Error).message}`,
      );
      ctx.skip();
      return;
    }
    expect(wv).toMatch(/^WEBVIEW_/);

    acoOk(['context', 'switch', '--name', wv]);
    expect(acoOk(['context', 'current']).stdout.trim()).toBe(wv);

    expect(elementText(findId(OUTPUT_SELECTOR, 'css selector'))).toBe('idle');

    acoOk([
      'element',
      'click',
      '--element',
      findId(BUTTON_SELECTOR, 'css selector'),
    ]);
    expect(elementText(findId(OUTPUT_SELECTOR, 'css selector'))).toBe(
      'clicked',
    );

    acoOk(['context', 'switch', '--name', 'NATIVE_APP']);
    expect(acoOk(['context', 'current']).stdout.trim()).toBe('NATIVE_APP');
  });
});
