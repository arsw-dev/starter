import { ruleTester } from '#/rules/rule.tester.ts';

import { noFunction } from './no-function.ts';

const invalid = (code: string) => ({
  code,
  errors: [
    {
      messageId: 'arrow',
    },
  ],
});

ruleTester.run('no-function', noFunction, {
  valid: [
    'const f = () => 1;',
    'const xs = [1].map((n) => n);',
    // Where the function keyword is part of the syntax
    'class A {\n  method() {\n    return 1;\n  }\n}',
    'class A {\n  get value() {\n    return 1;\n  }\n}',
    'const o = {\n  method() {\n    return 1;\n  },\n};',
    'const o = {\n  get value() {\n    return 1;\n  },\n  set value(v) {},\n};',
    // Arrows can't be generators
    'function* items() {\n  yield 1;\n}',
    'const items = function* () {\n  yield 1;\n};',
    // An overload signature has no body
    'function f(a: string): void;\nconst g = () => 1;',
  ],
  invalid: [
    invalid('function f() {\n  return 1;\n}'),
    invalid('const f = function () {\n  return 1;\n};'),
    invalid('const xs = [1].map(function (n) {\n  return n;\n});'),
    invalid('const o = {\n  f: function () {\n    return 1;\n  },\n};'),
    invalid('export function f() {\n  return 1;\n}'),
  ],
});
