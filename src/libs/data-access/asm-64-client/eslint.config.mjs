import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      'src/lib/apis/**/*',
      'src/lib/models/**/*',
      'src/lib/runtime.ts',
      'src/lib/index.ts',
      'src/lib/.openapi-generator/**/*',
      'src/lib/.openapi-generator-ignore',
    ],
  },
  {
    // explore.ts is a throwaway CLI script (see its header comment) — printing results to
    // stdout is the whole point, not a debug leftover.
    files: ['explore/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
