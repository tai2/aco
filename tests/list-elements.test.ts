import { describe, expect, it } from 'vitest';
import { AcoUserError } from '../src/lib/errors.js';
import { formatRows, listElements } from '../src/lib/list-elements.js';

const IOS = `<?xml version="1.0" encoding="UTF-8"?>
<AppiumAUT>
  <XCUIElementTypeApplication name="AUT" x="0" y="0" width="390" height="844">
    <XCUIElementTypeOther x="0" y="0" width="390" height="100" />
    <XCUIElementTypeButton name="login.button" label="Log in"
      x="24" y="120" width="84" height="44" />
    <XCUIElementTypeStaticText label="Welcome back" x="24" y="60" width="200" height="20" />
  </XCUIElementTypeApplication>
</AppiumAUT>`;

describe('listElements (ios)', () => {
  it('drops coordinate-only containers', () => {
    const rows = listElements(IOS, 'ios');
    expect(rows.some((r) => r.type === 'XCUIElementTypeOther')).toBe(false);
  });

  it('prefers accessibility id selector when name is present', () => {
    const rows = listElements(IOS, 'ios');
    const btn = rows.find((r) => r.type === 'XCUIElementTypeButton');
    expect(btn?.selector).toBe('accessibility id:login.button');
  });

  it('falls back to an ios predicate selector for label-only nodes', () => {
    const rows = listElements(IOS, 'ios');
    const txt = rows.find((r) => r.type === 'XCUIElementTypeStaticText');
    expect(txt?.selector).toBe('-ios predicate string:label == "Welcome back"');
  });

  it('parses ios x/y/width/height into a rect', () => {
    const rows = listElements(IOS, 'ios');
    const btn = rows.find((r) => r.type === 'XCUIElementTypeButton');
    expect(btn?.rect).toEqual({ x: 24, y: 120, width: 84, height: 44 });
  });

  it('throws AcoUserError on malformed XML', () => {
    expect(() => listElements('<a><b></a>', 'ios')).toThrow(AcoUserError);
  });
});

const ANDROID = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy>
  <android.widget.FrameLayout bounds="[0,0][1080,2400]">
    <android.widget.Button content-desc="login.button" text="LOG IN"
      bounds="[24,120][300,220]" />
    <android.widget.TextView text="Welcome back" bounds="[24,60][400,100]" />
  </android.widget.FrameLayout>
</hierarchy>`;

describe('listElements (android)', () => {
  it('prefers accessibility id (content-desc) selector', () => {
    const rows = listElements(ANDROID, 'android');
    const btn = rows.find((r) => r.type === 'android.widget.Button');
    expect(btn?.selector).toBe('accessibility id:login.button');
  });

  it('falls back to uiautomator text selector for text-only nodes', () => {
    const rows = listElements(ANDROID, 'android');
    const txt = rows.find((r) => r.type === 'android.widget.TextView');
    expect(txt?.selector).toBe(
      '-android uiautomator:new UiSelector().text("Welcome back")',
    );
  });

  it('parses android bounds into a rect', () => {
    const rows = listElements(ANDROID, 'android');
    const btn = rows.find((r) => r.type === 'android.widget.Button');
    expect(btn?.rect).toEqual({ x: 24, y: 120, width: 276, height: 100 });
  });
});

describe('listElements options and formatting', () => {
  it('caps rows with --limit', () => {
    expect(listElements(IOS, 'ios', { limit: 1 })).toHaveLength(1);
  });

  it('reports an empty-state message when nothing is labelled', () => {
    expect(formatRows([])).toBe(
      'no labelled elements found on the current screen',
    );
  });

  it('renders selector and rect on their own continuation lines', () => {
    const rows = listElements(IOS, 'ios');
    const out = formatRows(rows);
    expect(out).toContain('      selector: accessibility id:login.button');
    expect(out).toContain('      rect: 24,120 84x44');
  });
});
