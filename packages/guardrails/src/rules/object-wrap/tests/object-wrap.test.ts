import { objectWrap } from '#/rules/object-wrap/object-wrap.ts';
import { ruleTester } from '#/rules/rule.tester.ts';

ruleTester.run('object-wrap', objectWrap, {
  valid: [
    'const o = {}',
    'const o = {\n a: 1,\n};',
    'const { a, b } = o;',
    'const f = ({ a }: T) => a;',
    "import { a } from 'x';",
    'type T = {}',
    'type T = {\n a: string,\n};',
  ],
  invalid: [
    {
      code: 'const o = { a: 1 };',
      output: 'const o = {\n a: 1 };',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    {
      code: 'type T = { a: string };',
      output: 'type T = {\n a: string };',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    {
      code: 'const o = { a: 1, b: 2 };',
      output: 'const o = {\n a: 1, b: 2 };',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    // Only the first member decides: the formatter expands the rest
    {
      code: 'const o = { a: 1,\n  b: 2 };',
      output: 'const o = {\n a: 1,\n  b: 2 };',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    // A spread counts as a member
    {
      code: 'const o = { ...rest };',
      output: 'const o = {\n ...rest };',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    {
      code: 'call({ a: 1 });',
      output: 'call({\n a: 1 });',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    {
      code: 'type A = Hono<{ Bindings: Env }>;',
      output: 'type A = Hono<{\n Bindings: Env }>;',
      errors: [
        {
          messageId: 'wrap',
        },
      ],
    },
    // One report per object; both fixes apply in a single pass
    {
      code: 'const o = { inner: { a: 1 } };',
      output: 'const o = {\n inner: {\n a: 1 } };',
      errors: [
        {
          messageId: 'wrap',
        },
        {
          messageId: 'wrap',
        },
      ],
    },
    {
      code: 'type T = { a: { b: string } };',
      output: 'type T = {\n a: {\n b: string } };',
      errors: [
        {
          messageId: 'wrap',
        },
        {
          messageId: 'wrap',
        },
      ],
    },
  ],
});
