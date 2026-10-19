import { join } from 'node:path';

import { ruleTester } from '#/rules/rule.tester.ts';

import { importPath } from './import-path.ts';

// Files of this package, so the rule finds its package.json
const SRC = join(import.meta.dirname, '..', '..');
const inRule = join(SRC, 'rules', 'import-path', 'example.ts');
const atTop = join(SRC, 'example.ts');
const outsideSrc = join(SRC, '..', 'scripts', 'example.ts');

ruleTester.run('import-path', importPath, {
  valid: [
    {
      code: "import { a } from './import-path.ts';",
      filename: inRule,
    },
    // Outside the importer's folder: #/ is right
    {
      code: "import type { Rule } from '#/rules/rule.types.ts';",
      filename: inRule,
    },
    {
      code: "import { a } from './rules/rule.types.ts';",
      filename: atTop,
    },
    {
      code: "import { a } from '#/rules/rule.types.ts';",
      filename: outsideSrc,
    },
    {
      code: "import { z } from 'zod';",
      filename: inRule,
    },
  ],
  invalid: [
    {
      code: "import { a } from '#/rules/import-path/import-path.ts';",
      filename: inRule,
      output: "import { a } from './import-path.ts';",
      errors: [
        {
          messageId: 'local',
        },
      ],
    },
    // Below the importer's folder counts too
    {
      code: "export * from '#/rules/rule.types.ts';",
      filename: atTop,
      output: "export * from './rules/rule.types.ts';",
      errors: [
        {
          messageId: 'local',
        },
      ],
    },
    {
      code: "export { a } from '#/rules/rule.types.ts';",
      filename: atTop,
      output: "export { a } from './rules/rule.types.ts';",
      errors: [
        {
          messageId: 'local',
        },
      ],
    },
    {
      code: "const m = await import('#/rules/import-path/import-path.ts');",
      filename: inRule,
      output: "const m = await import('./import-path.ts');",
      errors: [
        {
          messageId: 'local',
        },
      ],
    },
  ],
});
