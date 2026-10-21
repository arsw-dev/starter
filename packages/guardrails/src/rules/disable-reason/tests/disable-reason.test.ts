import { disableReason } from '#/rules/disable-reason/disable-reason.ts';
import { ruleTester } from '#/rules/rule.tester.ts';

const invalid = (code: string) => ({
  code,
  errors: [
    {
      messageId: 'reason',
    },
  ],
});

ruleTester.run('disable-reason', disableReason, {
  valid: [
    '// oxlint-disable-next-line no-console -- the CLI talks to the terminal\nconsole.log(1);',
    'console.log(1); // oxlint-disable-line no-console -- the CLI talks to the terminal',
    '/* oxlint-disable no-console -- a script that only prints */\nconsole.log(1);',
    // Turning a rule back on needs no reason
    '/* oxlint-disable no-console -- a script that only prints */\nconsole.log(1);\n/* oxlint-enable no-console */',
    '// A comment that mentions oxlint-disable-next-line in passing\nconst a = 1;',
  ],
  invalid: [
    invalid('// oxlint-disable-next-line no-console\nconsole.log(1);'),
    invalid('console.log(1); // oxlint-disable-line no-console'),
    invalid('/* oxlint-disable no-console */\nconsole.log(1);'),
    invalid('/* oxlint-disable */\nconsole.log(1);'),
    invalid('/*oxlint-disable*/\nconsole.log(1);'),
    // One copied in from ESLint is held to the same
    invalid('// eslint-disable-next-line no-console\nconsole.log(1);'),
    // A dash with nothing after it isn't a reason
    invalid('// oxlint-disable-next-line no-console --\nconsole.log(1);'),
    invalid('// oxlint-disable-next-line no-console -- \nconsole.log(1);'),
  ],
});
