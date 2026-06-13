import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Run tests in forked child processes rather than worker threads so
    // process.env mutations propagate to libc (setenv). The android test
    // mutates process.env.HOME and expects os.homedir() — which reads via
    // uv_os_homedir → getenv("HOME") — to follow. In the default threads
    // pool, process.env is a per-thread JS mirror and doesn't reach libc.
    pool: 'forks',
  },
});
