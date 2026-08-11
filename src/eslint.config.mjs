import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            // Domain Layer - No dependencies allowed (pure business logic)
            {
              sourceTag: 'scope:domain',
              onlyDependOnLibsWithTags: [],
            },
            // Application Layer - Can only depend on domain and shared utilities
            {
              sourceTag: 'scope:application',
              onlyDependOnLibsWithTags: ['scope:domain', 'scope:shared'],
            },
            // Infrastructure Layer - Can depend on application, domain, shared utilities, and api-client
            {
              sourceTag: 'scope:infrastructure',
              onlyDependOnLibsWithTags: ['scope:application', 'scope:domain', 'scope:shared', 'scope:data-access'],
            },
            // Features Layer - Can depend on application, domain, and shared UI
            {
              sourceTag: 'scope:features',
              onlyDependOnLibsWithTags: ['scope:application', 'scope:domain', 'scope:shared'],
            },
            // Shared libraries - Can depend on each other and domain
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:domain'],
            },
            // App Layer - Composition root: can depend on everything
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:domain',
                'scope:features',
                'scope:application',
                'scope:infrastructure',
                'scope:shared',
                'scope:app',
              ],
            },
            // E2E Tests - Can depend on data-access for API DTOs
            {
              sourceTag: 'scope:e2e',
              onlyDependOnLibsWithTags: ['scope:data-access'],
            },
            // Prevent features from importing each other (feature isolation)
            {
              sourceTag: 'feature:device',
              notDependOnLibsWithTags: ['feature:player', 'feature:file-transfer'],
            },
            {
              sourceTag: 'feature:player',
              notDependOnLibsWithTags: ['feature:device', 'feature:file-transfer'],
            },
            {
              sourceTag: 'feature:file-transfer',
              notDependOnLibsWithTags: ['feature:player', 'feature:device'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
    ],
    rules: {
      // Disallow explicit 'any' type annotations - prefer unknown or specific types
      '@typescript-eslint/no-explicit-any': 'error',
      // allow the levels that carry real signal; ban the debug ones
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Spec files are legitimate console users (test setup/mocks, assertions on output).
    files: ['**/*.spec.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // log-helper.ts is the workspace logging helper and legitimately wraps console.log.
    files: ['**/log-helper.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
