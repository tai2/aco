import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Short-circuit PostCSS config autodiscovery (matches vitest.config.ts) so
  // vitest does not walk up the tree hunting for a postcss config.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    // One simulator, one session: the e2e specs must never run in parallel.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // The session is shared across all specs (started lazily by the first spec,
    // resolved from the store by the rest). globalSetup reaps orphan Appium/WDA
    // from prior killed runs before the suite, and tears the session down after.
    globalSetup: ['./e2e/helpers/global.ts'],
    // A cold WDA / UiAutomator2 boot in beforeAll can take minutes. Each spec's
    // beforeAll overrides this inline (420_000) to outlast `session start`'s own
    // wall-clock budget; keep the global default aligned for any other hook.
    hookTimeout: 420_000,
    testTimeout: 120_000,
    bail: 0,
  },
});
