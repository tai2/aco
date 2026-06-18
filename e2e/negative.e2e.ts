import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk, runAco } from './helpers/aco.js';
import { findId } from './helpers/find.js';
import { resetApp } from './helpers/nav.js';
import { startSession, stopAllSessions } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 420_000);
afterAll(() => {
  stopAllSessions();
});

describe('negative paths', () => {
  beforeEach(() => {
    resetApp();
  });

  it('a disabled Home row is present but clicking it does not navigate', () => {
    // The Permissions row is a plain MarkedText (not a Link), so clicking it
    // is a no-op and the app stays on Home.
    acoOk([
      'element',
      'click',
      '--element',
      findId(TestIDs.home.navPermissions),
    ]);
    const xml = acoOk(['source']).stdout;
    expect(xml).toContain(TestIDs.home.title);
    expect(xml).toContain(TestIDs.home.navPermissions);
  });

  it('finding a non-existent element fails with a clean error', () => {
    const r = runAco([
      'element',
      'find',
      '--using',
      'accessibility id',
      '--value',
      'does.not.exist',
    ]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no such element|element/i);
  });

  it('a css selector find in the native context fails', () => {
    const r = runAco([
      'element',
      'find',
      '--using',
      'css selector',
      '--value',
      '#not-a-native-thing',
    ]);
    expect(r.status).not.toBe(0);
  });
});
