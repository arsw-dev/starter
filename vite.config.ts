import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    printWidth: 80,
    singleQuote: true,
    proseWrap: 'always',
    sortImports: {
      groups: [
        'value-builtin',
        'value-external',
        'value-internal',
        'value-subpath',
        ['value-parent', 'value-sibling', 'value-index'],
        'type-import',
        'style',
        'unknown',
      ],
      internalPattern: ['@arsw/'],
      newlinesBetween: true,
    },
  },
  lint: {
    plugins: [
      'typescript',
      'unicorn',
      'import',
      'node',
      'promise',
      'oxc',
      'react',
    ],
    categories: {
      correctness: 'error',
      suspicious: 'error',
      perf: 'error',
    },
    options: {
      typeAware: true,
      typeCheck: true,
      reportUnusedDisableDirectives: 'error',
      respectEslintDisableDirectives: false,
    },
    rules: {
      'arsw/object-wrap': 'error',
      // Exports: named, listed once, at the end of the file
      'import/no-default-export': 'error',
      'import/exports-last': 'error',
      'import/group-exports': 'error',
      // Imports: name the .ts file, never climb out with ../
      // never import only for side effects
      'import/extensions': [
        'error',
        'always',
        {
          ignorePackages: true,
        },
      ],
      'import/no-relative-parent-imports': 'error',
      'import/no-unassigned-import': 'error',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      // Types
      'typescript/consistent-type-definitions': ['error', 'type'],
      'typescript/consistent-type-imports': 'error',
      'typescript/no-explicit-any': 'error',
      // Promises: awaited, returned or voided,
      // and never passed where a callback's result is ignored
      'typescript/no-floating-promises': 'error',
      'typescript/no-misused-promises': 'error',
      // No blanket escapes: no @ts-ignore, no rule-less disable comments
      'typescript/ban-ts-comment': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'node/no-process-env': 'error',
    },
    overrides: [
      {
        // Tools load these from their default export: config files, and
        // entry points (oxlint a plugin, Cloudflare a Worker)
        files: ['**/*.config.ts', '**/main.ts'],
        rules: {
          'import/no-default-export': 'off',
        },
      },
    ],
    jsPlugins: ['@arsw/guardrails/plugin'],
  },
});
