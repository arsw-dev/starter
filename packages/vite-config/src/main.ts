import { fileURLToPath } from 'node:url';

import { pack } from './pack.ts';

import type { UserConfig } from 'vite-plus';

// Formatting, one way in every repo
const fmt = {
  printWidth: 80,
  singleQuote: true,
  proseWrap: 'always',
  // Tailwind's classes in the order its own Prettier plugin gives them
  sortTailwindcss: true,
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
  // Generated, never written by hand: `wrangler types`, drizzle-kit's
  // snapshots, the OpenAPI document, TanStack Router's route tree
  ignorePatterns: [
    '**/worker-configuration.d.ts',
    '**/migrations/meta/**',
    '**/openapi.json',
    '**/routeTree.gen.ts',
  ],
} satisfies NonNullable<UserConfig['fmt']>;

// The lint rules, guardrails' among them, one set in every repo
const lint = {
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
    // Layout the formatter leaves alone: braces once there's an else, blank
    // lines between steps, objects and type literals never on one line
    'arsw/braced-else': 'error',
    'arsw/breathe': 'error',
    'arsw/object-wrap': 'error',
    // Exports: named, listed once, at the end of the file
    'import/no-default-export': 'error',
    'import/exports-last': 'error',
    'import/group-exports': 'error',
    'arsw/no-inline-export': 'error',
    // An export list in order, as sort-imports keeps an import's names
    'arsw/sorted-exports': 'error',
    // Imports: name the .ts file, never climb out with ../
    // never import only for side effects, apart from a stylesheet, which Vite
    // loads as one
    'import/extensions': [
      'error',
      'always',
      {
        ignorePackages: true,
        checkTypeImports: true,
      },
    ],
    'import/no-relative-parent-imports': 'error',
    'arsw/import-path': 'error',
    'import/no-unassigned-import': [
      'error',
      {
        allow: ['**/*.css'],
      },
    ],
    'unicorn/filename-case': [
      'error',
      {
        case: 'kebabCase',
      },
    ],
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    // One import per module and kind: a value import and an import type
    // stay apart, as prefer-top-level needs
    'import/no-duplicates': 'error',
    // An import's names in order; oxfmt orders the imports themselves
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    // Functions: arrows only
    'arsw/no-function': 'error',
    // Types
    'typescript/consistent-type-definitions': ['error', 'type'],
    'typescript/consistent-type-imports': 'error',
    'typescript/no-explicit-any': 'error',
    // An API marked deprecated still compiles, until the release that drops it
    'typescript/no-deprecated': 'error',
    // Promises: awaited, returned or voided,
    // and never passed where a callback's result is ignored
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    // No blanket escapes: no @ts-ignore, and a disable comment names its
    // rules and says why
    'typescript/ban-ts-comment': 'error',
    'unicorn/no-abusive-eslint-disable': 'error',
    'arsw/disable-reason': 'error',
    'node/no-process-env': 'error',
    // For the old JSX transform, which needed React in scope; react-jsx
    // imports what it needs
    'react/react-in-jsx-scope': 'off',
    // The React Compiler memoizes a context's value, as it does everything
    // else, so building one inline costs nothing
    'react/jsx-no-constructed-context-values': 'off',
  },
  overrides: [
    {
      // Tools load these from their default export: config files, entry
      // points (oxlint a plugin, Cloudflare a Worker) and Storybook's preview
      files: [
        '**/*.config.ts',
        '**/main.ts',
        '**/.storybook/preview.ts',
        '**/.storybook/preview.tsx',
      ],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    {
      // A declaration file's interfaces are there to merge, as an
      // augmentation does, which a type alias can't
      files: ['**/*.d.ts'],
      rules: {
        'typescript/consistent-type-definitions': 'off',
      },
    },
    {
      // An entry references its declaration files, so any program that
      // includes it, a front end's typed client among them, has them too
      files: ['**/main.ts'],
      rules: {
        'typescript/triple-slash-reference': [
          'error',
          {
            path: 'always',
          },
        ],
      },
    },
    {
      // A route file keeps TanStack's layout: the exported route first, then
      // its component as a function declaration, which hoisting makes work
      files: [
        '**/src/routes/__root.tsx',
        '**/src/routes/**/index.tsx',
        '**/src/routes/**/route.tsx',
      ],
      rules: {
        'arsw/no-function': 'off',
        'arsw/no-inline-export': 'off',
        'import/exports-last': 'off',
        'import/group-exports': 'off',
      },
    },
    {
      // What an API sends comes from its operations, so they name the
      // columns they read and return
      files: ['**/*.operations.ts'],
      rules: {
        'arsw/named-columns': 'error',
      },
    },
  ],
  // Resolved here, so a repo needs only this package, not guardrails too
  jsPlugins: [fileURLToPath(import.meta.resolve('@arsw/guardrails/plugin'))],
  ignorePatterns: [
    // Lint skips only what a .gitignore lists: without this, a repo with none
    // lints every dependency, type-aware, and runs out of memory
    '**/node_modules/**',
    // Generated by `wrangler types` and TanStack Router, never written by hand
    '**/worker-configuration.d.ts',
    '**/routeTree.gen.ts',
  ],
} satisfies NonNullable<UserConfig['lint']>;

export { fmt, lint, pack };
