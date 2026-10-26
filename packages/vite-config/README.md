# @arsw/vite-config

[Vite+](https://viteplus.dev) settings shared across repos: formatting, lint
with the [`@arsw/guardrails`](https://www.npmjs.com/package/@arsw/guardrails)
rules, and library builds.

```sh
pnpm add -D @arsw/vite-config vite-plus
```

## Formatting and lint

```ts
// vite.config.ts
import { defineConfig } from 'vite-plus';

import { fmt, lint } from '@arsw/vite-config';

export default defineConfig({
  fmt,
  lint,
});
```

`vp check` then formats, lints with type-aware rules and type-checks. The
guardrails plugin comes with this package: a repo doesn't install it.

A type augmentation, which only an interface can make, lives in a declaration
file of its own, and two rules make room for it:

- **In a `*.d.ts`**, `typescript/consistent-type-definitions` is off: a
  declaration file's interfaces are there to merge, which a `type` alias can't.
- **In a `main.ts`**, `typescript/triple-slash-reference` allows a reference by
  path (`/// <reference path="./types.d.ts" />`), so any program that includes
  the entry, such as a front end's typed client, has the declarations too.

Two more allowances follow conventions a tool sets:

- **A stylesheet may be imported for its side effects**
  (`import './styles.css'`): `import/no-unassigned-import` allows `**/*.css`,
  which Vite loads that way. A side-effect import of a module still fails.
- **Storybook's preview may export a default:** `import/no-default-export` is
  off in `.storybook/preview.ts` and `.storybook/preview.tsx`, which Storybook
  loads by their default export, as it is in `*.config.ts` and `main.ts`.
  Nothing else in `.storybook/` changes.

## Library builds

`pack(entries)` gives `vp pack` the settings a package published to npm needs:
each entry built to `dist/`, the package's own files bundled and every
dependency left as an import, with declarations from TypeScript 7's native
compiler.

```ts
// packages/<name>/vite.config.ts
import { defineConfig } from 'vite-plus';

import { pack } from '@arsw/vite-config';

export default defineConfig({
  pack: pack(['src/main.ts']),
});
```

Declarations need `typescript` 7 installed. `pack(entries, { dts: false })`
builds without them.

## License

MIT
