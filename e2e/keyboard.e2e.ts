import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToKeyboard } from './helpers/nav.js';
import { startSession } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);

describe('keyboard send-keys round-trip on /keyboard', () => {
  beforeEach(() => {
    resetToKeyboard();
  });

  it('echo is empty before any input', () => {
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:');
  });

  it('typed text round-trips through the echo (autoCorrect=false)', () => {
    acoOk([
      'element',
      'send-keys',
      '--element',
      findId(TestIDs.kb.input),
      '--text',
      'hello',
    ]);
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:hello');
  });

  it('text containing a space round-trips verbatim', () => {
    acoOk([
      'element',
      'send-keys',
      '--element',
      findId(TestIDs.kb.input),
      '--text',
      'a b',
    ]);
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:a b');
  });

  it('top-level send-keys --selector round-trips through the echo', () => {
    acoOk([
      'send-keys',
      '--selector',
      `accessibility id:${TestIDs.kb.input}`,
      '--text',
      'hello',
    ]);
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:hello');
  });

  it('top-level send-keys --label round-trips through the echo', () => {
    acoOk(['send-keys', '--label', TestIDs.kb.input, '--text', 'hi']);
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:hi');
  });

  it('top-level send-keys clears the field first by default', () => {
    acoOk(['send-keys', '--label', TestIDs.kb.input, '--text', 'hello']);
    acoOk(['send-keys', '--label', TestIDs.kb.input, '--text', 'bye']);
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:bye');
  });

  it('top-level send-keys --no-clear appends to existing contents', () => {
    acoOk(['send-keys', '--label', TestIDs.kb.input, '--text', 'ab']);
    acoOk([
      'send-keys',
      '--label',
      TestIDs.kb.input,
      '--text',
      'cd',
      '--no-clear',
    ]);
    expect(elementText(findId(TestIDs.kb.echo))).toBe('echo:abcd');
  });
});
