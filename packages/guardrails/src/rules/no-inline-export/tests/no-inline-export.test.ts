import { noInlineExport } from '#/rules/no-inline-export/no-inline-export.ts';
import { ruleTester } from '#/rules/rule.tester.ts';

ruleTester.run('no-inline-export', noInlineExport, {
  valid: [
    'const a = 1;\nconst b = () => a;\n\nexport { a, b };',
    'type Point = {\n  x: number;\n};\n\nexport type { Point };',
    // Re-exports declare nothing
    "export { a } from './a.ts';",
    "export * from './a.ts';",
    // Default exports are import/no-default-export's
    'const a = 1;\n\nexport default a;',
  ],
  invalid: [
    {
      code: 'export const a = 1;',
      errors: [
        {
          messageId: 'inline',
        },
      ],
    },
    {
      code: 'export const f = () => 1;',
      errors: [
        {
          messageId: 'inline',
        },
      ],
    },
    {
      code: 'export function f() {}',
      errors: [
        {
          messageId: 'inline',
        },
      ],
    },
    {
      code: 'export class A {}',
      errors: [
        {
          messageId: 'inline',
        },
      ],
    },
    {
      code: 'export type Point = {\n  x: number;\n};',
      errors: [
        {
          messageId: 'inline',
        },
      ],
    },
    // Even at the very end of the file, where import/exports-last passes it
    {
      code: 'const a = 1;\n\nexport const b = a;',
      errors: [
        {
          messageId: 'inline',
        },
      ],
    },
  ],
});
