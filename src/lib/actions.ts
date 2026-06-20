export type PointerType = 'touch' | 'mouse' | 'pen';

type PointerItem =
  | {
      type: 'pointerMove';
      x: number;
      y: number;
      duration: number;
      origin: 'viewport';
    }
  | { type: 'pointerDown'; button: number }
  | { type: 'pointerUp'; button: number }
  | { type: 'pause'; duration: number }
  | { type: 'pointerCancel' };

type KeyItem =
  | { type: 'keyDown'; value: string }
  | { type: 'keyUp'; value: string }
  | { type: 'pause'; duration: number };

export interface PointerSource {
  id: string;
  type: 'pointer';
  parameters: { pointerType: PointerType };
  actions: PointerItem[];
}

export interface KeySource {
  id: string;
  type: 'key';
  actions: KeyItem[];
}

export type InputSource = PointerSource | KeySource;

// Matches WebdriverIO's MOVE_PARAM_DEFAULTS so a `move` between `down` and `up`
// reads as a natural swipe glide (research.md §2).
const MOVE_DEFAULT_DURATION = 100;

export function parseGesture(spec: string): PointerItem[] {
  const steps = spec
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (steps.length === 0) {
    throw new Error('gesture is empty; expected e.g. "down 200 600, up"');
  }
  return steps.map((step, i) => parseStep(step, i + 1));
}

function parseStep(step: string, n: number): PointerItem {
  const [verb, ...rest] = step.split(/\s+/);
  const nums = rest.map((tok) => {
    const v = Number(tok);
    if (!Number.isFinite(v)) {
      throw new Error(`gesture step ${n} "${step}": "${tok}" is not a number`);
    }
    return v;
  });
  switch (verb) {
    case 'move': {
      const [x, y, duration] = nums;
      if (x === undefined || y === undefined || nums.length > 3) {
        throw new Error(
          `gesture step ${n} "${step}": move needs <x> <y> [duration]`,
        );
      }
      return {
        type: 'pointerMove',
        x,
        y,
        duration: duration ?? MOVE_DEFAULT_DURATION,
        origin: 'viewport',
      };
    }
    case 'down':
      return { type: 'pointerDown', button: nums[0] ?? 0 };
    case 'up':
      return { type: 'pointerUp', button: nums[0] ?? 0 };
    case 'pause': {
      const [duration] = nums;
      if (duration === undefined || nums.length !== 1) {
        throw new Error(`gesture step ${n} "${step}": pause needs <duration>`);
      }
      return { type: 'pause', duration };
    }
    case 'cancel':
      return { type: 'pointerCancel' };
    default:
      throw new Error(`gesture step ${n} "${step}": unknown verb "${verb}"`);
  }
}

// Serialize plain text into a `key` source: a keyDown+keyUp pair per character
// (the W3C "type these letters" shape, research.md §6). Array.from keeps astral
// code points (emoji, combining sequences) intact rather than splitting them on
// UTF-16 surrogate halves.
export function buildKeySource(text: string): KeySource {
  const actions: KeyItem[] = [];
  for (const ch of Array.from(text)) {
    actions.push({ type: 'keyDown', value: ch });
    actions.push({ type: 'keyUp', value: ch });
  }
  return { id: 'keyboard', type: 'key', actions };
}

export function buildActions(
  gestures: string[],
  pointerType: PointerType,
  text?: string,
): InputSource[] {
  const sources: InputSource[] = gestures.map((g, i) => ({
    id: `finger${i + 1}`,
    type: 'pointer',
    parameters: { pointerType },
    actions: parseGesture(g),
  }));
  if (text != null && text.length > 0) {
    sources.push(buildKeySource(text));
  }
  return sources;
}

// Escape-hatch path: validate the already-parsed `--json` value is an array and
// return it untouched. Deliberate pass-through -- no touch-default injection, so
// a raw payload reaches Appium exactly as written (Trade-offs §C).
export function asRawActions(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      '--json must be a W3C actions array (e.g. [{"type":"pointer",...}])',
    );
  }
  return raw;
}

export function parsePointerType(v: string): PointerType {
  if (v === 'touch' || v === 'mouse' || v === 'pen') return v;
  throw new Error(`--pointer-type must be touch|mouse|pen (got "${v}")`);
}
