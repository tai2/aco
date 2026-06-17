import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk, runAco } from './helpers/aco.js';
import { elementAttribute, elementText, findId } from './helpers/find.js';
import { resetToElements } from './helpers/nav.js';
import { expected, isAndroid, isIOS } from './helpers/platform.js';
import { startSession, stopAllSessions } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 360_000);
afterAll(() => {
  stopAllSessions();
});

describe('element actions on /elements', () => {
  beforeEach(() => {
    resetToElements();
  });

  it('reads the static label text', () => {
    expect(elementText(findId(TestIDs.elements.label))).toBe('Static label');
  });

  it('reads the uncontrolled input value attribute', () => {
    expect(elementAttribute(findId(TestIDs.elements.input), 'value')).toBe(
      'initial-value',
    );
  });

  it('click advances the tap counter', () => {
    acoOk(['element', 'click', '--element', findId(TestIDs.elements.button)]);
    expect(elementText(findId(TestIDs.elements.counter))).toBe('taps:1');
  });

  it('finds the label by class name with the platform-specific class', () => {
    const r = acoOk([
      'element',
      'find',
      '--using',
      'class name',
      '--value',
      expected.staticTextClass,
    ]);
    expect(typeof (JSON.parse(r.stdout.trim()) as unknown)).toBe('string');
  });

  it.skipIf(!isIOS)('finds the label by -ios predicate string', () => {
    const id = findId(
      `name == "${TestIDs.elements.label}"`,
      '-ios predicate string',
    );
    expect(elementText(id)).toBe('Static label');
  });

  it.skipIf(!isAndroid)('finds the label by -android uiautomator', () => {
    const id = findId(
      `new UiSelector().description("${TestIDs.elements.label}")`,
      '-android uiautomator',
    );
    expect(elementText(id)).toBe('Static label');
  });

  it('find for a missing id errors cleanly', () => {
    const r = runAco([
      'element',
      'find',
      '--using',
      'accessibility id',
      '--value',
      'nope.does.not.exist',
    ]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no such element|element/i);
  });
});
