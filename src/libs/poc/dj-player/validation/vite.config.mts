/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/poc/dj-player',
  // Without an explicit tsconfig, the Angular plugin defaults to `./tsconfig.spec.json` resolved
  // against this config's root — a file that does not exist here, since the real one sits one level
  // up. Left unset, the plugin silently drops every file outside its (empty) program, and every spec
  // "passes" with zero collected tests rather than failing loudly.
  plugins: [angular({ tsconfig: resolve(__dirname, '../tsconfig.validation.json') }), nxViteTsPaths()],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['./**/*.spec.ts'],
    reporters: ['default'],
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 5000,
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../../../coverage/libs/poc/dj-player',
      provider: 'v8' as const,
    },
  },
}));
