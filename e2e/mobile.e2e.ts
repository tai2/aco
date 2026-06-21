import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk, runAco } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToGestures } from './helpers/nav.js';
import { APP_IDENTIFIER, isIOS } from './helpers/platform.js';
import { startSession } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);

describe('mobile call escape hatch (unvalidated)', () => {
  it('forwards an unknown extension and surfaces the server error verbatim', () => {
    // No local snapshot pre-empt anymore: the call reaches the server, which
    // rejects it itself. The exact wording is driver-specific (UiAutomator2:
    // "Unsupported execute method ..."; XCUITest: "Method is not implemented"),
    // so we assert the server's WebDriverError surfaced verbatim -- not the old
    // local "unknown extension" bail that we removed.
    const r = runAco(['mobile', 'call', '--name', 'mobile: thisDoesNotExist']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/WebDriverError/);
    expect(r.stderr).not.toMatch(/unknown extension/i);
  });

  it('invokes mobile: terminateApp with the platform-correct param key', () => {
    const args = isIOS
      ? { bundleId: APP_IDENTIFIER }
      : { appId: APP_IDENTIFIER };
    const r = acoOk([
      'mobile',
      'call',
      '--name',
      'mobile: terminateApp',
      '--args',
      JSON.stringify(args),
    ]);
    // terminateApp returns a boolean-ish JSON payload; the call exiting 0 is
    // the contract under test.
    expect(r.status).toBe(0);
  });
});

describe('mobile list (live extensions endpoint)', () => {
  it('lists the connected driver-advertised extensions', () => {
    const r = acoOk(['mobile', 'list']);
    expect(r.status).toBe(0);
    // The connected driver advertises terminateApp on both platforms.
    expect(r.stdout).toContain('terminateApp');
  });

  it('--json emits the raw endpoint payload', () => {
    const r = acoOk(['mobile', 'list', '--json']);
    expect(r.status).toBe(0);
    const body = JSON.parse(r.stdout) as { rest?: { driver?: unknown } };
    expect(body.rest?.driver).toBeDefined();
  });
});

describe('first-class platform extensions (generated aco ios / aco android)', () => {
  beforeEach(() => {
    resetToGestures();
  });

  if (isIOS) {
    it('aco ios tap advances the /gestures counter (mobile: tap)', () => {
      // Exercises the generated `aco ios tap` -> mobile: tap end-to-end: the
      // snake-cased leaf, the source-derived flag coercion (--x/--y as numbers,
      // --elementId as a string), and execute/sync dispatch. With an element id
      // present the x/y offset is interpreted relative to that element, so an
      // in-bounds offset taps the target without absolute coords.
      const targetId = findId(TestIDs.gestures.target);
      const r = acoOk([
        'ios',
        'tap',
        '--elementId',
        targetId,
        '--x',
        '10',
        '--y',
        '10',
      ]);
      expect(r.status).toBe(0);
      expect(elementText(findId(TestIDs.gestures.taps))).toBe('taps:1');
    });
  } else {
    it('aco android click-gesture advances the /gestures counter (mobile: clickGesture)', () => {
      // Exercises the generated `aco android click-gesture` -> mobile:
      // clickGesture end-to-end: the snake-cased leaf, the --elementId string
      // flag, and execute/sync dispatch.
      const targetId = findId(TestIDs.gestures.target);
      const r = acoOk(['android', 'click-gesture', '--elementId', targetId]);
      expect(r.status).toBe(0);
      expect(elementText(findId(TestIDs.gestures.taps))).toBe('taps:1');
    });
  }
});
