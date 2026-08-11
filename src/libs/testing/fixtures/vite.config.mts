/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/testing/fixtures',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', ['json', { outputFile: '../../../.test-timings/testing-fixtures.json' }]],
    testTimeout: 2000,
    hookTimeout: 5000,
    onConsoleLog(log) {
      if (log.includes('Could not parse CSS stylesheet')) {
        return false;
      }
    },
    coverage: {
      reportsDirectory: '../../../coverage/libs/testing/fixtures',
      provider: 'v8' as const,
    },
  },
}));
