import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
