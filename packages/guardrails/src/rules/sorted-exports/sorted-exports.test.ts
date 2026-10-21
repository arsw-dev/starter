import { ruleTester } from '#/rules/rule.tester.ts';

import { sortedExports } from './sorted-exports.ts';

const unsorted = (code: string, output: string | null) => ({
  code,
  output,
  errors: [
    {
      messageId: 'order',
    },
  ],
});

ruleTester.run('sorted-exports', sortedExports, {
  valid: [
    'const a = 1;\nconst b = 2;\n\nexport { a, b };',
    'type A = 1;\ntype B = 2;\n\nexport type { A, B };',
    'const a = 1;\n\nexport { a };',
    // By character code: capitals before lowercase, as sort-imports
    'const B = 1;\nconst a = 2;\n\nexport { B, a };',
    "export { a, b } from './x.ts';",
    // An alias sorts by the name it's exported as
    'const z = 1;\nconst b = 2;\n\nexport { z as a, b };',
    "const a = 1;\n\nexport { a as 'a-b', a as 'b' };",
    // A declaration lists no names
    'export const a = 1;',
  ],
  invalid: [
    unsorted(
      'const a = 1;\nconst b = 2;\n\nexport { b, a };',
      'const a = 1;\nconst b = 2;\n\nexport { a, b };',
    ),
    unsorted(
      'type A = 1;\ntype B = 2;\n\nexport type { B, A };',
      'type A = 1;\ntype B = 2;\n\nexport type { A, B };',
    ),
    unsorted(
      'const B = 1;\nconst a = 2;\n\nexport { a, B };',
      'const B = 1;\nconst a = 2;\n\nexport { B, a };',
    ),
    unsorted(
      "export { b, a } from './x.ts';",
      "export { a, b } from './x.ts';",
    ),
    unsorted(
      'const a = 1;\nconst z = 2;\n\nexport { z as b, a as c, a };',
      'const a = 1;\nconst z = 2;\n\nexport { a, z as b, a as c };',
    ),
    // Across lines: the names are joined, and the formatter lays them out
    unsorted(
      'const a = 1;\nconst b = 2;\n\nexport {\n  b,\n  a,\n};',
      'const a = 1;\nconst b = 2;\n\nexport {\n  a, b,\n};',
    ),
    // A comment between the names has no place to go: reported, not fixed
    unsorted(
      'const a = 1;\nconst b = 2;\n\nexport { b, /* first */ a };',
      null,
    ),
  ],
});
