import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk, runAco } from './helpers/aco.js';
import { elementAttribute, elementText, findId } from './helpers/find.js';
import { resetToElements } from './helpers/nav.js';
import { expected, isAndroid, isIOS } from './helpers/platform.js';
import { startSession } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);

describe('element actions on /elements', () => {
  beforeEach(() => {
    resetToElements();
  });

  it('reads the static label text', () => {
    expect(elementText(findId(TestIDs.elements.label))).toBe('Static label');
  });

  it('reads the uncontrolled input value attribute', () => {
    expect(
      elementAttribute(findId(TestIDs.elements.input), expected.valueAttr),
    ).toBe('initial-value');
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

  it('reports the static label as displayed', () => {
    const r = acoOk([
      'element',
      'displayed',
      '--element',
      findId(TestIDs.elements.label),
    ]);
    expect(JSON.parse(r.stdout.trim())).toBe(true);
  });

  it('reports the button as enabled', () => {
    const r = acoOk([
      'element',
      'enabled',
      '--element',
      findId(TestIDs.elements.button),
    ]);
    expect(JSON.parse(r.stdout.trim())).toBe(true);
  });

  it('returns a sane element rect for the label', () => {
    const r = acoOk([
      'element',
      'rect',
      '--element',
      findId(TestIDs.elements.label),
    ]);
    const rect = JSON.parse(r.stdout.trim()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });

  it('reports the focused input as the active element', () => {
    const input = findId(TestIDs.elements.input);
    acoOk(['element', 'click', '--element', input]);
    const r = acoOk(['element', 'active']);
    expect(typeof (JSON.parse(r.stdout.trim()) as unknown)).toBe('string');
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
