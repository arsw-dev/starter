import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vite-plus/test';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    sourceType: 'module',
    parserOptions: {
      lang: 'ts',
    },
  },
});

export { ruleTester };
