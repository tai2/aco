import { describe, expect, it } from 'vitest';
import { stripForbiddenHeaders } from '../src/lib/wd-client.js';

describe('stripForbiddenHeaders', () => {
  // Regression guard for webdriverio#15265: webdriver's transport sets the
  // Fetch-spec "forbidden" headers Connection and Content-Length by hand, which
  // Node >=26 rejects with UND_ERR_INVALID_ARG. We remove them before the
  // request is built.
  it('removes Connection and Content-Length from a Headers object', () => {
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      Connection: 'keep-alive',
      'Content-Length': '42',
      Accept: 'application/json',
    });
    const out = stripForbiddenHeaders({ headers });

    const result = out.headers as Headers;
    expect(result.has('Connection')).toBe(false);
    expect(result.has('Content-Length')).toBe(false);
    // Untouched headers survive.
    expect(result.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(result.get('Accept')).toBe('application/json');
  });

  it('returns the same requestOptions reference (in-place mutation)', () => {
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: new Headers({ Connection: 'keep-alive' }),
    };
    expect(stripForbiddenHeaders(requestOptions)).toBe(requestOptions);
  });

  it('is a no-op when headers is not a Headers instance', () => {
    const requestOptions: RequestInit = {
      headers: { Connection: 'keep-alive' },
    };
    // Must not throw on a plain-object HeadersInit; webdriver always passes a
    // Headers instance, but the type permits other shapes.
    expect(() => stripForbiddenHeaders(requestOptions)).not.toThrow();
    expect(stripForbiddenHeaders(requestOptions)).toBe(requestOptions);
  });
});
