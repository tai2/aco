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
    // A cold WDA / UiAutomator2 boot in beforeAll can take minutes.
    hookTimeout: 360_000,
    testTimeout: 120_000,
    bail: 0,
  },
});
