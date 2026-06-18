import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestIDs } from '../aut/src/testids.js';
import { acoOk } from './helpers/aco.js';
import { elementText, findId } from './helpers/find.js';
import { resetApp } from './helpers/nav.js';
import { startSession } from './helpers/session.js';

beforeAll(() => {
  startSession();
  // Ensure we are on the root route before reading Home.
  resetApp();
}, 420_000);

describe('Home screen: source, screenshot, find+text', () => {
  it('source contains the Home testID strings', () => {
    const xml = acoOk(['source']).stdout;
    expect(xml).toContain(TestIDs.home.title);
    expect(xml).toContain(TestIDs.home.navElements);
  });

  it('screenshot --out produces a non-empty PNG', () => {
    const out = join(tmpdir(), `aco-e2e-home-${process.pid}.png`);
    try {
      const r = acoOk(['screenshot', '--out', out]);
      expect(r.stdout).toMatch(/saved screenshot/);
      expect(existsSync(out)).toBe(true);
      const bytes = readFileSync(out);
      expect(bytes.length).toBeGreaterThan(0);
      // PNG magic number: 89 50 4E 47.
      expect(bytes.subarray(0, 4)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );
    } finally {
      rmSync(out, { force: true });
    }
  });

  it('find + text reads the Home title', () => {
    expect(elementText(findId(TestIDs.home.title))).toBe('aco AUT');
  });
});
