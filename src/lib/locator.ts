export const W3C_ELEMENT_ID = 'element-6066-11e4-a52e-4f735466cecf';

export const STRATEGIES = [
  'accessibility id',
  'xpath',
  'class name',
  'css selector',
  '-ios predicate string',
  '-ios class chain',
  '-android uiautomator',
  '-android viewtag',
  'id',
] as const;

export function unwrapElementId(ref: Record<string, string>): string {
  // The raw W3C findElement command resolves to a `{ error, message }` value
  // on no-match rather than rejecting, so surface it as a real failure
  // instead of JSON-stringifying the error object as if it were an id.
  if (ref && typeof ref === 'object' && 'error' in ref) {
    throw new Error(ref.message || ref.error || 'no such element');
  }
  return ref[W3C_ELEMENT_ID] ?? ref.ELEMENT ?? JSON.stringify(ref);
}
