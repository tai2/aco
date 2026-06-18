import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToGestures } from './helpers/nav.js';
import { isIOS } from './helpers/platform.js';
import { startSession, stopAllSessions } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);
afterAll(() => {
  stopAllSessions();
});

describe('gestures: tap + swipe on /gestures', () => {
  beforeEach(() => {
    resetToGestures();
  });

  it('tap on the target advances its counter', () => {
    const targetId = findId(TestIDs.gestures.target);
    if (isIOS) {
      // iOS mobile: tap requires coordinates (tap.ts:24-28). With an element
      // id present the x/y are interpreted relative to that element, so an
      // in-bounds offset taps the target without needing absolute coords.
      acoOk(['tap', '--element', targetId, '--x', '10', '--y', '10']);
    } else {
      // Android mobile: clickGesture accepts an element id (tap.ts:36-42).
      acoOk(['tap', '--element', targetId]);
    }
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
});
