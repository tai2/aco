// Retry a flaky aco-driven step a few times. The iOS simulator + WDA stack
// throws transient errors under CI load that are not product bugs: `mobile:
// activateApp` returns "Timed out attempting to launch app"
// (XCTDaemonErrorDomain Code=5), and a just-navigated screen can 404 a `find`
// before its transition settles. A second attempt almost always succeeds. This
// lives in the e2e helpers (not in aco itself) so the CLI stays a thin, honest
// passthrough that surfaces the server's error verbatim.
export function withRetry<T>(fn: () => T, attempts = 3, delayMs = 1000): T {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) sleepSync(delayMs);
    }
  }
  throw lastErr;
}

// The e2e helpers drive aco via spawnSync (helpers/aco.ts), so the whole suite
// is synchronous -- there is no event loop to await a timer on. Atomics.wait on
// a throwaway SharedArrayBuffer blocks the thread for `ms` without spinning.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
