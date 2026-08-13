/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/features/player',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', ['json', { outputFile: '../../../.test-timings/player.json' }]],
    testTimeout: 2000,
    hookTimeout: 5000,
    // Every spec in this project runs compileComponents() against the real descendant
    // component tree (see src/lib/player-view). Running all 29 files at the default
    // full-CPU thread concurrency causes worker processes to exceed their heap limit
    // and crash mid-run ("Worker terminated due to reaching memory limit"), producing
    // collateral failures in unrelated files and, at higher file counts, no summary at
    // all. Capping concurrency trades some wall-clock time for a run that reliably
    // finishes and reports. maxThreads was originally 4 (tuned running this project
    // alone); CI runs it as one of 16 projects under `nx affected --parallel=4`, so
    // this project's own threads compete with several other projects' threads for the
    // runner's fixed RAM at once - that combined peak, not this project in isolation,
    // is what crashed a worker on CI. Lowered further to reduce this project's own
    // peak footprint during that shared window.
    poolOptions: {
      threads: {
        maxThreads: 2,
      },
    },
    onConsoleLog(log) {
      if (log.includes('Could not parse CSS stylesheet')) {
        return false;
      }
    },
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/player',
      provider: 'v8' as const,
    },
  },
}));
