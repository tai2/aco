import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToWebview } from './helpers/nav.js';
import { startSession, stopAllSessions } from './helpers/session.js';
import { waitForWebviewContext } from './helpers/webview.js';

// HTML element ids from the inline document in aut/app/webview.tsx. They are
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
  it('drives the embedded webview through a context switch and back', () => {
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

    acoOk(['context', 'switch', '--name', 'NATIVE_APP']);
    expect(acoOk(['context', 'current']).stdout.trim()).toBe('NATIVE_APP');
  });
});
