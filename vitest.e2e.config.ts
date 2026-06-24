import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Short-circuit PostCSS config autodiscovery (matches vitest.config.ts) so
  // vitest does not walk up the tree hunting for a postcss config.
  css: { postcss: { plugins: [] } },
  // The specs import `aut/src/testids.ts` (directly or via helpers/nav.ts).
  // Transforming a file under aut/ makes esbuild discover the nearest
  // tsconfig -- aut/tsconfig.json -- which `extends: "expo/tsconfig.base"`.
  // On CI the AUT .app comes from cache, so `pnpm aut:install` is skipped and
  // aut/node_modules (hence expo) is absent, and that extends fails to resolve.
  // testids.ts is plain string constants; an inline tsconfig lets esbuild
  // transform it without searching for any tsconfig on disk. It MUST be a
  // string -- vite only skips on-disk tsconfig discovery for a string
  // tsconfigRaw; an object is merged with the discovered file (which is what we
  // need to avoid).
  esbuild: { tsconfigRaw: '{}' },
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
    // Catch-all for residual simulator/WDA flake that survives the targeted
    // guards (nav.ts retries activateApp; the workflow waits for sim boot). A
    // retry re-runs the test AND its beforeEach (resetApp) -- it does NOT re-run
    // beforeAll, so a cold session-start failure still fails fast. Kept low so a
    // genuinely broken assertion is not masked behind slow reruns.
    retry: 1,
  },
});
