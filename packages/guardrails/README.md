# @arsw/guardrails

[oxlint](https://oxc.rs/docs/guide/usage/linter) rules for what its built-in
rules don't cover. Each one reports what it found and how to fix it.

| Rule                    | What it asks for                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `arsw/braced-else`      | Braces on every branch once an `if` has an `else`                                                         |
| `arsw/breathe`          | Blank lines between a function's steps: before a `return`, around an `if`, after a block that spans lines |
| `arsw/disable-reason`   | A reason on every disable comment: `// oxlint-disable-next-line <rule> -- <why>`                          |
| `arsw/import-path`      | `./` for a file in the same folder, `#/` for one elsewhere in the package, never `../`                    |
| `arsw/named-columns`    | Drizzle's `select()` and `returning()` given their columns, so a whole row never reaches a response       |
| `arsw/no-function`      | Arrow functions, not the `function` keyword (methods and generators excepted)                             |
| `arsw/no-inline-export` | Exports listed once, at the end of the file                                                               |
| `arsw/object-wrap`      | One property per line in object literals and type literals                                                |
| `arsw/sorted-exports`   | An export list in the order `sort-imports` gives an import's names                                        |

## Using it

Through [`@arsw/vite-config`](https://www.npmjs.com/package/@arsw/vite-config),
which turns them on with the rest of the lint settings. Or on its own, in a
Vite+ config:

```ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    jsPlugins: ['@arsw/guardrails/plugin'],
    rules: {
      'arsw/no-function': 'error',
    },
  },
});
```

## License

MIT
