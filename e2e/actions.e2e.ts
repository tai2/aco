import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk } from './helpers/aco.js';
import { elementRect, elementText, findId } from './helpers/find.js';
import { resetToGestures } from './helpers/nav.js';
import { isIOS } from './helpers/platform.js';
import { startSession } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);

// Derive the center point of an element from its W3C rect so the gesture
// coordinates track the real device layout rather than hardcoded pixels
// (plan Trade-off §H). The `target` is top-anchored, so the center always
// lands inside the safe tappable band.
function centerOf(testId: string): { x: number; y: number } {
  const r = elementRect(findId(testId));
  return {
    x: Math.round(r.x + r.width / 2),
    y: Math.round(r.y + r.height / 2),
  };
}

// Read the `taps:N` counter as a number.
function tapsCount(): number {
  const text = elementText(findId(TestIDs.gestures.taps));
  return Number(text.slice('taps:'.length));
}

describe('actions: W3C pointer/key on /gestures', () => {
  beforeEach(() => {
    resetToGestures();
  });

  it('a down/up pointer chain taps the target', () => {
    const { x, y } = centerOf(TestIDs.gestures.target);
    acoOk(['actions', '--gesture', `move ${x} ${y} 0, down, pause 60, up`]);
    expect(elementText(findId(TestIDs.gestures.taps))).toBe('taps:1');
  });

  it('a swipe gesture executes without tearing down the screen', () => {
    const r = acoOk([
      'actions',
      '--gesture',
      'move 200 600 0, down, move 200 250 300, up',
    ]);
    expect(r.stdout.trim()).toBe('ok');
    // Portability smoke: the scroll container is still present in the source
    // tree afterward, confirming the gesture scrolled rather than crashing the
    // screen. (We avoid asserting a specific high-index row: XCUITest dumps the
    // full child tree, but UiAutomator2 only includes the rendered/visible row
    // window, so the exact rows present depend on the scroll distance.)
    expect(acoOk(['source']).stdout).toContain(TestIDs.gestures.scroll);
  });

  it('--type enters letters into the focused field', () => {
    // Focus the field with the proven `aco tap` path (raw-pointer focus is
    // flaky across XCUITest/UiAutomator2 soft keyboards -- plan Trade-off §I),
    // then exercise --type as the unit under test. The session pins the device
    // to English (helpers/session.ts) so the IME delivers letters verbatim
    // rather than composing them (a Japanese keyboard would turn "hi" into kana).
    const fieldId = findId(TestIDs.gestures.typeField);
    if (isIOS) {
      acoOk(['tap', '--element', fieldId, '--x', '10', '--y', '10']);
    } else {
      acoOk(['tap', '--element', fieldId]);
    }
    acoOk(['actions', '--type', 'hi']);
    expect(elementText(findId(TestIDs.gestures.typedValue))).toBe('typed:hi');
  });

  it('--no-release holds input that --release-only cleans up', () => {
    const { x, y } = centerOf(TestIDs.gestures.target);
    // Open a held pointer (press, no lift), then close it with the standalone
    // release. Both must succeed without error. We don't assert an absolute tap
    // count for the held press itself: how a press split across two calls
    // resolves is driver-specific (XCUITest completes the tap when the release
    // lands, UiAutomator2 delivers no click), so the count would diverge.
    acoOk(['actions', '--gesture', `move ${x} ${y} 0, down`, '--no-release']);
    acoOk(['actions', '--release-only']);
    // The cross-platform property that matters: the held state was cleaned up,
    // so a subsequent self-contained tap still registers as exactly one
    // increment (plan Trade-off §E) -- no stuck pointer dropping or doubling it.
    const before = tapsCount();
    acoOk(['actions', '--gesture', `move ${x} ${y} 0, down, pause 60, up`]);
    expect(tapsCount()).toBe(before + 1);
  });
});
