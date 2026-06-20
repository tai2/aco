import { beforeAll, describe, expect, it } from 'vitest';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToWebview } from './helpers/nav.js';
import { startSession } from './helpers/session.js';
import { waitForWebviewContext } from './helpers/webview.js';

// HTML element ids from the bundled page in aut/assets/webview.html. They are
// web-DOM ids (not RN testIDs), so the dot must be CSS-escaped in a selector.
const BUTTON_SELECTOR = '#webview\\.button';
const OUTPUT_SELECTOR = '#webview\\.output';

// Driving an in-app webview needs an environment-provided automation bridge:
// a debuggable WKWebView surfaced as a context on iOS, or a Chromedriver
// matching the system WebView's Chrome version on Android. Both are
// environment/toolchain concerns (research.md §6.6/§7.9), not aco/AUT bugs, so
// when they are missing we skip rather than fail. These patterns deliberately
// do NOT match assertion failures, so real regressions still surface.
const WEBVIEW_UNAVAILABLE = /no WEBVIEW_.* context|chromedriver/i;

beforeAll(() => {
  startSession();
  resetToWebview();
}, 420_000);

describe('webview context switching on /webview', () => {
  it('drives the embedded webview through a context switch and back', (ctx) => {
    try {
      const wv = waitForWebviewContext();
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

      // Web navigation commands operate on the active WEBVIEW_* context.
      // The bundled page exposes a non-empty URL...
      expect(acoOk(['url']).stdout.trim().length).toBeGreaterThan(0);
      // ...and reloading it resets the click output back to idle.
      acoOk(['refresh']);
      expect(elementText(findId(OUTPUT_SELECTOR, 'css selector'))).toBe('idle');

      acoOk(['context', 'switch', '--name', 'NATIVE_APP']);
      expect(acoOk(['context', 'current']).stdout.trim()).toBe('NATIVE_APP');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!WEBVIEW_UNAVAILABLE.test(msg)) throw err;
      console.warn(`[context.e2e] skipping webview test: ${msg}`);
      ctx.skip();
    }
  });
});
