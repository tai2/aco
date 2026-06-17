import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetToKeyboard } from './helpers/nav.js';
import { startSession, stopAllSessions } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 360_000);
afterAll(() => {
  stopAllSessions();
});

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
});
