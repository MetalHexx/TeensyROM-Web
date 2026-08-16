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
];
