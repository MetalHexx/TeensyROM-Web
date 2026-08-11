/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/features/file-transfer',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', ['json', { outputFile: '../../../.test-timings/features-file-transfer.json' }]],
    testTimeout: 2000,
    hookTimeout: 5000,
    onConsoleLog(log) {
      if (log.includes('Could not parse CSS stylesheet')) {
        return false;
      }
    },
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/file-transfer',
      provider: 'v8' as const,
    },
  },
}));
