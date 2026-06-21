import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToGestures } from './helpers/nav.js';
import { startSession } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);

describe('gestures: tap + swipe on /gestures', () => {
  beforeEach(() => {
    resetToGestures();
  });

  it('tap on the target advances its counter', () => {
    // performActions taps the element center on both platforms (tap.ts);
    // no element-relative coordinate workaround needed anymore.
    acoOk(['tap', '--label', TestIDs.gestures.target]);
    expect(elementText(findId(TestIDs.gestures.taps))).toBe('taps:1');
  });

  it('swipe up within the scroll view completes without error', () => {
    const scrollId = findId(TestIDs.gestures.scroll);
    // --percent 0.5 keeps the W3C pointer drag in the middle of the scrollable
    // element. WDIO's swipe is a real pointer gesture (not mobile: swipeGesture),
    // so the default percent (0.95) starts at ~97.5% down the flex:1 /gestures
    // ScrollView -- inside Android's bottom gesture-nav zone, which backgrounds
    // the app instead of scrolling (same caveat as scroll-into-view below).
    const r = acoOk([
      'swipe',
      '--direction',
      'up',
      '--percent',
      '0.5',
      '--element',
      scrollId,
    ]);
    expect(r.stdout.trim()).toBe('ok');
    // The scroll container is still present afterward, confirming the swipe
    // scrolled within the screen rather than backgrounding the app (Android's
    // gesture-nav zone) or crashing it. We avoid asserting a specific high-index
    // row: XCUITest dumps the full child tree, but UiAutomator2 only includes the
    // rendered/visible row window, so which rows are present depends on the
    // platform and scroll distance (same portability caveat as actions.e2e.ts).
    expect(acoOk(['source']).stdout).toContain(TestIDs.gestures.scroll);
  });

  it('swipe up resolves the scroll view by --selector', () => {
    // Same gesture as above, but naming the target with the ergonomic
    // selector form (parity with `aco tap`) instead of a pre-resolved id.
    const r = acoOk([
      'swipe',
      '--direction',
      'up',
      '--percent',
      '0.5',
      '--selector',
      `accessibility id:${TestIDs.gestures.scroll}`,
    ]);
    expect(r.stdout.trim()).toBe('ok');
    expect(acoOk(['source']).stdout).toContain(TestIDs.gestures.scroll);
  });

  it('scroll-into-view brings a deep row on screen', () => {
    // row(29) is below the fold, so we scroll "up" (finger bottom -> top, the
    // WDIO default) to reveal lower content. "down" would scroll toward the top
    // of the list and never reach it (WDIO calculateFromTo, build/node.js:6101).
    //
    // --percent 0.5 keeps the swipe in the middle of the scrollable element.
    // The /gestures ScrollView is flex:1 and reaches the screen bottom, so the
    // default percent (0.95) starts the swipe at ~97.5% down -- inside Android's
    // bottom gesture-nav zone, which backgrounds the app instead of scrolling.
    const r = acoOk([
      'scroll-into-view',
      `accessibility id:${TestIDs.gestures.row(29)}`,
      '--direction',
      'up',
      '--percent',
      '0.5',
    ]);
    expect(r.stdout.trim()).toBe('ok');
    // On success WDIO confirms the row is displayed (either it scrolled to it or
    // it was already on screen). This exercises the real scroll-until-visible
    // loop end-to-end against the live driver.
  });
});
