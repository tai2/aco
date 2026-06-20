import { describe, expect, it } from 'vitest';
import {
  asRawActions,
  buildActions,
  buildKeySource,
  parseGesture,
  parsePointerType,
} from '../src/lib/actions.js';

describe('parseGesture', () => {
  it('parses a swipe into ordered move/down/move/up items', () => {
    expect(parseGesture('move 200 600 0, down, move 200 200 300, up')).toEqual([
      { type: 'pointerMove', x: 200, y: 600, duration: 0, origin: 'viewport' },
      { type: 'pointerDown', button: 0 },
      {
        type: 'pointerMove',
        x: 200,
        y: 200,
        duration: 300,
        origin: 'viewport',
      },
      { type: 'pointerUp', button: 0 },
    ]);
  });

  it('defaults a move duration to 100ms when omitted', () => {
    expect(parseGesture('move 10 20')).toEqual([
      { type: 'pointerMove', x: 10, y: 20, duration: 100, origin: 'viewport' },
    ]);
  });

  it('parses pause and cancel items', () => {
    expect(parseGesture('pause 800, cancel')).toEqual([
      { type: 'pause', duration: 800 },
      { type: 'pointerCancel' },
    ]);
  });

  it('parses explicit button numbers for down/up', () => {
    expect(parseGesture('down 1, up 1')).toEqual([
      { type: 'pointerDown', button: 1 },
      { type: 'pointerUp', button: 1 },
    ]);
  });

  it('throws on an unknown verb', () => {
    expect(() => parseGesture('mvoe 1 2')).toThrow(/unknown verb "mvoe"/);
  });

  it('throws on a non-numeric arg', () => {
    expect(() => parseGesture('move 1 x')).toThrow(/"x" is not a number/);
  });

  it('throws on an empty gesture', () => {
    expect(() => parseGesture('   ')).toThrow(/gesture is empty/);
  });

  it('throws on move with the wrong arity', () => {
    expect(() => parseGesture('move 1')).toThrow(/move needs <x> <y>/);
    expect(() => parseGesture('move 1 2 3 4')).toThrow(/move needs <x> <y>/);
  });

  it('throws on pause without a duration', () => {
    expect(() => parseGesture('pause')).toThrow(/pause needs <duration>/);
  });
});

describe('buildKeySource', () => {
  it('emits a keyDown/keyUp pair per character', () => {
    expect(buildKeySource('ab')).toEqual({
      id: 'keyboard',
      type: 'key',
      actions: [
        { type: 'keyDown', value: 'a' },
        { type: 'keyUp', value: 'a' },
        { type: 'keyDown', value: 'b' },
        { type: 'keyUp', value: 'b' },
      ],
    });
  });

  it('keeps an astral code point as a single pair', () => {
    const emoji = '😀';
    const src = buildKeySource(emoji);
    expect(src.actions).toEqual([
      { type: 'keyDown', value: emoji },
      { type: 'keyUp', value: emoji },
    ]);
  });
});

describe('buildActions', () => {
  it('defaults pointerType to touch and assigns finger ids for multi-touch', () => {
    const sources = buildActions(['down, up', 'down, up'], 'touch');
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      id: 'finger1',
      type: 'pointer',
      parameters: { pointerType: 'touch' },
    });
    expect(sources[1]).toMatchObject({
      id: 'finger2',
      type: 'pointer',
      parameters: { pointerType: 'touch' },
    });
  });

  it('honors an explicit pointerType override', () => {
    const [src] = buildActions(['down, up'], 'pen');
    expect(src).toMatchObject({ parameters: { pointerType: 'pen' } });
  });

  it('appends a single key source after the pointer sources when text is given', () => {
    const sources = buildActions(['down, up'], 'touch', 'hi');
    expect(sources).toHaveLength(2);
    expect(sources[0]?.type).toBe('pointer');
    expect(sources[1]).toMatchObject({ id: 'keyboard', type: 'key' });
  });

  it('omits the key source for empty or undefined text', () => {
    expect(buildActions(['down, up'], 'touch')).toHaveLength(1);
    expect(buildActions(['down, up'], 'touch', '')).toHaveLength(1);
  });
});

describe('asRawActions', () => {
  it('returns its input array verbatim (no touch-default injection)', () => {
    const raw = [{ type: 'pointer', id: 'finger1', actions: [] }];
    expect(asRawActions(raw)).toBe(raw);
  });

  it('throws on a non-array', () => {
    expect(() => asRawActions({ type: 'pointer' })).toThrow(
      /must be a W3C actions array/,
    );
  });
});

describe('parsePointerType', () => {
  it('accepts touch|mouse|pen', () => {
    expect(parsePointerType('touch')).toBe('touch');
    expect(parsePointerType('mouse')).toBe('mouse');
    expect(parsePointerType('pen')).toBe('pen');
  });

  it('throws on an unknown pointer type', () => {
    expect(() => parsePointerType('finger')).toThrow(
      /--pointer-type must be touch\|mouse\|pen/,
    );
  });
});
