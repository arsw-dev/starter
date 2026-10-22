import { createRequire } from 'node:module';
import path from 'node:path';

import type { UserConfig } from 'vite-plus';

type PackConfig = Exclude<NonNullable<UserConfig['pack']>, unknown[]>;

type Options = {
  // Declarations for the package's types; false for one nothing imports types
  // from
  dts?: boolean;
};

type GetExePath = {
  default: () => string;
};

const require = createRequire(import.meta.url);

// TypeScript 7's native compiler, which writes the declarations. tsdown finds it
// itself only for 7.0 or @typescript/native-preview, so it's given the path the
// installed typescript package reports
const tsgoPath = () => {
  const root = path.dirname(require.resolve('typescript/package.json'));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the module's own declaration, typescript/lib/getExePath.d.ts, which its exports don't reach
  const exe = require(path.join(root, 'lib/getExePath.js')) as GetExePath;

  return exe.default();
};

// A package built for npm by `vp pack`: each entry to dist/, its own files
// bundled and every dependency left as an import
const pack = (entry: string[], { dts = true }: Options = {}) =>
  ({
    entry,
    deps: {
      neverBundle: true,
    },
    dts: dts
      ? {
          generator: 'tsgo',
          tsgo: {
            path: tsgoPath(),
          },
        }
      : false,
  }) satisfies PackConfig;

export { pack };
