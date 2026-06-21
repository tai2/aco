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
    const r = acoOk(['swipe', '--direction', 'up', '--element', scrollId]);
    expect(r.stdout.trim()).toBe('ok');
    // The ScrollView renders all rows, so a high-index row stays present in
    // the source tree -- asserting it confirms the gesture left the tree
    // intact rather than crashing the screen (research.md §6.11).
    const xml = acoOk(['source']).stdout;
    expect(xml).toContain(TestIDs.gestures.row(29));
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
