import { ruleTester } from '#/rules/rule.tester.ts';

import { breathe } from './breathe.ts';

ruleTester.run('breathe', breathe, {
  valid: [
    'const f = () => {\n  return 1;\n};',
    'const f = () => {\n  const a = 1;\n\n  return a;\n};',
    // A one-line if opening a block needs nothing above it
    'const f = (a) => {\n  if (!a) return 0;\n\n  return a + 1;\n};',
    // Consecutive one-line ifs are one group
    'const f = (a, b) => {\n  if (!a) return 0;\n  if (!b) return 1;\n\n  g();\n};',
    'const f = (a) => {\n  g();\n\n  if (a) {\n    h();\n  }\n\n  i();\n};',
    'const f = (a) => {\n  if (a) {\n    g();\n  }\n};',
    // An if/else chain is one statement: blank lines around it, none inside
    'const f = (a) => {\n  g();\n\n  if (a) {\n    h();\n  } else {\n    i();\n  }\n\n  j();\n};',
    // A comment belongs to the statement under it
    'const f = (a) => {\n  g();\n\n  // why\n  if (a) h();\n};',
    'const f = (a) => {\n  switch (a) {\n    case 1:\n      g();\n\n      return 1;\n  }\n\n  return 0;\n};',
    "import { a } from 'x';\n\nif (a) g();",
    // A loop on one line is no block to breathe after
    'const f = (b) => {\n  for (const a of b) g(a);\n  h();\n};',
  ],
  invalid: [
    {
      code: 'const f = () => {\n  const a = 1;\n  return a;\n};',
      output: 'const f = () => {\n  const a = 1;\n\n  return a;\n};',
      errors: [
        {
          messageId: 'return',
        },
      ],
    },
    // The blank line goes above the comment
    {
      code: 'const f = () => {\n  g();\n  // why\n  return 1;\n};',
      output: 'const f = () => {\n  g();\n\n  // why\n  return 1;\n};',
      errors: [
        {
          messageId: 'return',
        },
      ],
    },
    {
      code: 'const f = (b) => {\n  for (const a of b) {\n    g(a);\n  }\n  h();\n};',
      output:
        'const f = (b) => {\n  for (const a of b) {\n    g(a);\n  }\n\n  h();\n};',
      errors: [
        {
          messageId: 'block',
        },
      ],
    },
    {
      code: 'const f = () => {\n  try {\n    g();\n  } catch {\n    h();\n  }\n  return 1;\n};',
      output:
        'const f = () => {\n  try {\n    g();\n  } catch {\n    h();\n  }\n\n  return 1;\n};',
      errors: [
        {
          messageId: 'return',
        },
      ],
    },
    {
      code: 'const f = (a) => {\n  if (a) {\n    g();\n    return 1;\n  }\n};',
      output:
        'const f = (a) => {\n  if (a) {\n    g();\n\n    return 1;\n  }\n};',
      errors: [
        {
          messageId: 'return',
        },
      ],
    },
    // A one-line if needs a blank line after it too, unless another follows
    {
      code: 'const f = (a) => {\n  if (!a) return 0;\n  const b = a + 1;\n\n  return b;\n};',
      output:
        'const f = (a) => {\n  if (!a) return 0;\n\n  const b = a + 1;\n\n  return b;\n};',
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
    {
      code: 'const f = (a) => {\n  g();\n  if (!a) return;\n};',
      output: 'const f = (a) => {\n  g();\n\n  if (!a) return;\n};',
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
    {
      code: 'const f = (a) => {\n  g();\n  if (a) {\n    h();\n  }\n};',
      output: 'const f = (a) => {\n  g();\n\n  if (a) {\n    h();\n  }\n};',
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
    {
      code: 'const f = (a) => {\n  if (a) {\n    g();\n  }\n  h();\n};',
      output: 'const f = (a) => {\n  if (a) {\n    g();\n  }\n\n  h();\n};',
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
    // Only one-line ifs group: a braced if after one still breathes
    {
      code: 'const f = (a) => {\n  if (!a) return;\n  if (a > 1) {\n    g();\n  }\n};',
      output:
        'const f = (a) => {\n  if (!a) return;\n\n  if (a > 1) {\n    g();\n  }\n};',
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
    // A return after a group of one-line ifs
    {
      code: 'const f = (a, b) => {\n  if (!a) return 0;\n  if (!b) return 1;\n  return 2;\n};',
      output:
        'const f = (a, b) => {\n  if (!a) return 0;\n  if (!b) return 1;\n\n  return 2;\n};',
      errors: [
        {
          messageId: 'return',
        },
      ],
    },
    // Inside a case too
    {
      code: 'const f = (a) => {\n  switch (a) {\n    case 1:\n      g();\n      return 1;\n  }\n};',
      output:
        'const f = (a) => {\n  switch (a) {\n    case 1:\n      g();\n\n      return 1;\n  }\n};',
      errors: [
        {
          messageId: 'return',
        },
      ],
    },
    // At the top level, after the imports
    {
      code: "import { a } from 'x';\nif (a) g();",
      output: "import { a } from 'x';\n\nif (a) g();",
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
    {
      code: 'const f = (a) => {\n  g();\n  // why\n  if (a) h();\n};',
      output: 'const f = (a) => {\n  g();\n\n  // why\n  if (a) h();\n};',
      errors: [
        {
          messageId: 'if',
        },
      ],
    },
  ],
});
