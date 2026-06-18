import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acoOk, runAco } from './helpers/aco.js';
import { APP_IDENTIFIER, isIOS } from './helpers/platform.js';
import { startSession, stopAllSessions } from './helpers/session.js';

beforeAll(() => {
  startSession();
}, 360_000);
afterAll(() => {
  stopAllSessions();
});

describe('mobile call escape hatch', () => {
  it('rejects an unknown extension before any RPC', () => {
    const r = runAco(['mobile', 'call', '--name', 'mobile: thisDoesNotExist']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/unknown extension/i);
  });

  it('rejects a call missing a required param', () => {
    // mobile: deepLink requires "url" on both drivers.
    const r = runAco([
      'mobile',
      'call',
      '--name',
      'mobile: deepLink',
      '--args',
      '{}',
    ]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/requires param "url"/);
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
