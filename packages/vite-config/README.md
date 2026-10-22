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
