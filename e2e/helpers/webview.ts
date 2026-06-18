import { spawnSync } from 'node:child_process';
import { acoOk } from './aco.js';

// Block synchronously so the helper composes with the spawnSync-based runAco
// (no async churn in specs). Atomics.wait would work too but is overkill here.
function spawnSyncSleep(seconds: number): void {
  spawnSync('sleep', [String(seconds)]);
}

// The AUT exposes no "webview ready" testID (research.md §6.6, §7.9), so poll
// `aco context list` until a WEBVIEW_* entry appears. The suffix is
// `WEBVIEW_net.tai2.aco.aut` on Android and a pid-based name on iOS, so match
// the prefix rather than a fixed name.
export function waitForWebviewContext(timeoutMs = 30_000): string {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const contexts = JSON.parse(
      acoOk(['context', 'list']).stdout.trim(),
    ) as string[];
    const wv = contexts.find((c) => c.startsWith('WEBVIEW_'));
    if (wv) return wv;
    if (Date.now() > deadline) {
      throw new Error(
        `no WEBVIEW_* context after ${timeoutMs}ms: ${JSON.stringify(contexts)}`,
      );
    }
    spawnSyncSleep(0.5);
  }
}
