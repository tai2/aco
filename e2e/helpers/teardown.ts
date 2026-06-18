import { stopAllSessions } from './session.js';

// vitest globalSetup: the e2e suite shares one Appium session / WDA launch
// across every spec (see session.ts). Stop it exactly once, after all specs
// have run, instead of in each spec's afterAll.
export function teardown(): void {
  stopAllSessions();
}
