import { ruleTester } from '#/rules/rule.tester.ts';

import { bracedElse } from './braced-else.ts';

ruleTester.run('braced-else', bracedElse, {
  valid: [
    // A guard has no else
    'if (!a) return;',
    'if (a) {\n  b();\n}',
    'if (a) {\n  b();\n} else {\n  c();\n}',
    'if (a) {\n  b();\n} else if (c) {\n  d();\n} else {\n  e();\n}',
    'if (a) {\n  b();\n} else if (c) {\n  d();\n}',
    // A guard inside a branch is its own if, with no else
    'if (a) {\n  if (!b) return;\n} else {\n  c();\n}',
  ],
  invalid: [
    {
      code: 'if (a) b();\nelse c();',
      output: 'if (a) {\nb();\n}\nelse {\nc();\n}',
      errors: [
        {
          messageId: 'braces',
        },
      ],
    },
    // One braced branch isn't enough
    {
      code: 'if (a) {\n  b();\n} else c();',
      output: 'if (a) {\n  b();\n} else {\nc();\n}',
      errors: [
        {
          messageId: 'braces',
        },
      ],
    },
    // Down the whole chain, and reported once
    {
      code: 'if (a) {\n  b();\n} else if (c) d();\nelse {\n  e();\n}',
      output: 'if (a) {\n  b();\n} else if (c) {\nd();\n}\nelse {\n  e();\n}',
      errors: [
        {
          messageId: 'braces',
        },
      ],
    },
    // An else if is an else too, even with no final else
    {
      code: 'if (a) b();\nelse if (c) d();',
      output: 'if (a) {\nb();\n}\nelse if (c) {\nd();\n}',
      errors: [
        {
          messageId: 'braces',
        },
      ],
    },
  ],
});
