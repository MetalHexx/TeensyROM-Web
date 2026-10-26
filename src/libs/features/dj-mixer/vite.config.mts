/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/features/dj-mixer',
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
    reporters: ['default', ['json', { outputFile: '../../../.test-timings/dj-mixer.json' }]],
    // Nearly every spec here renders a whole deck or the whole mixer through TestBed, which takes
    // 0.5-3s on a loaded CI runner. At the default 2000ms whichever test ran slowest failed, a
    // different one each run, so the limit is set for the project instead of per test.
    testTimeout: 10000,
    hookTimeout: 10000,
    onConsoleLog(log) {
      if (log.includes('Could not parse CSS stylesheet')) {
        return false;
      }
    },
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/dj-mixer',
      provider: 'v8' as const,
    },
  },
}));
