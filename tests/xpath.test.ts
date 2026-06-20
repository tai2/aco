import { describe, expect, it } from 'vitest';
import { AcoUserError } from '../src/lib/errors.js';
import { applyXpath } from '../src/lib/xpath.js';

const PAGE_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<AppiumAUT>
  <XCUIElementTypeApplication name="AUT">
    <XCUIElementTypeButton name="Login" label="Log in" />
    <XCUIElementTypeButton name="Logout" label="Log out" />
    <XCUIElementTypeStaticText name="Welcome" label="Welcome" />
  </XCUIElementTypeApplication>
</AppiumAUT>`;

describe('applyXpath', () => {
  it('returns a serialized fragment for a node-set match', () => {
    const out = applyXpath(
      PAGE_SOURCE,
      '//XCUIElementTypeButton[@name="Login"]',
    );
    expect(out).toContain('<XCUIElementTypeButton');
    expect(out).toContain('name="Login"');
    expect(out).toContain('label="Log in"');
  });

  it('newline-joins multiple matches', () => {
    const out = applyXpath(PAGE_SOURCE, '//XCUIElementTypeButton');
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('name="Login"');
    expect(lines[1]).toContain('name="Logout"');
  });

  it('returns an empty string when nothing matches', () => {
    expect(applyXpath(PAGE_SOURCE, '//XCUIElementTypeSwitch')).toBe('');
  });

  it('renders count() as a numeric string', () => {
    expect(applyXpath(PAGE_SOURCE, 'count(//XCUIElementTypeButton)')).toBe('2');
  });

  it('renders string() of an attribute as text', () => {
    expect(applyXpath(PAGE_SOURCE, 'string(//*[@name="Login"]/@label)')).toBe(
      'Log in',
    );
  });

  it('throws AcoUserError on an invalid XPath expression', () => {
    expect(() => applyXpath(PAGE_SOURCE, '//[invalid')).toThrow(AcoUserError);
    expect(() => applyXpath(PAGE_SOURCE, '//[invalid')).toThrow(
      /invalid XPath/,
    );
  });

  it('throws AcoUserError on malformed XML input', () => {
    expect(() => applyXpath('<a><b></a>', '//a')).toThrow(AcoUserError);
    expect(() => applyXpath('<a><b></a>', '//a')).toThrow(/could not parse/);
  });
});
