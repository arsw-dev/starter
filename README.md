# starter

A pnpm monorepo for Cloudflare Workers on [Vite+](https://viteplus.dev): an API,
a front end that reaches it, and the tooling they share. It's a GitHub template:
new repos start from it, and it's the reference for how they're built.

## What's in it

| Folder                     | What it is                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/todos-api`       | A Worker: a CRUD API on [Hono](https://hono.dev) with OpenAPI routes, and [D1](https://developers.cloudflare.com/d1/) through [Drizzle](https://orm.drizzle.team)                           |
| `apps/todos-app`           | A Worker: a [TanStack Start](https://tanstack.com/start) front end, reaching todos-api over a service binding                                                                               |
| `packages/start-hono`      | A front end's way to one of its Hono APIs: typed calls over the binding, `ApiError`, `defineApi` for query and mutation options, the QueryClient's defaults, SSR and CSRF                   |
| `packages/hook-form-query` | Forms: [React Hook Form](https://react-hook-form.com), [Zod](https://zod.dev) and [TanStack Query](https://tanstack.com/query), with schema helpers, `useFormMutation` and field components |
| `packages/vite-config`     | The formatting and lint settings every repo shares, guardrails included                                                                                                                     |
| `packages/guardrails`      | oxlint rules for what the built-in rules don't cover                                                                                                                                        |
| `packages/tsconfig`        | TypeScript presets: Node, a Worker, an app                                                                                                                                                  |

Each Worker runs on its own, as it does deployed. In development, Wrangler's dev
registry connects the app's `TODOS_API` binding to whichever `todos-api` is
running.

## Getting started

Node 26 and pnpm 11 (the version in `package.json`'s `packageManager`).

```sh
pnpm install
pnpm --filter @arsw/todos-api db:migrate   # the local D1 database's table
pnpm dev                                    # both Workers, each line prefixed with its package
```

The app is at <http://localhost:5173> and the API at <http://localhost:8787>.
`pnpm dev` runs every package's `dev` in one terminal; run a package's own
`pnpm dev` instead for Vite's keyboard shortcuts.

## Commands

| Command            | What it does                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `vp check`         | Formatting, lint (with type-aware rules) and type checking. `vp check --fix` fixes what it can |
| `vp test`          | Every package's tests, each in its own runtime: a Worker's in workerd, the rest in Node        |
| `pnpm dev`         | Every package's dev server                                                                     |
| `pnpm db:generate` | In an API: a migration from its models' changes                                                |
| `pnpm db:migrate`  | In an API: applies its migrations to the local database                                        |
| `pnpm openapi`     | In an API: writes its OpenAPI document, `docs/openapi.json`                                    |

The pre-commit hook regenerates the Workers' types, runs `vp check` and
`vp test`, and fails if an API's OpenAPI document no longer matches its routes.
The pre-push hook refuses a push to `main`: changes go through pull requests,
and CI runs the same checks on each.

## Starting a repo from it

**Use this template** on GitHub, then:

- Rename the pair: `todos-api` and `todos-app` become your API and app, in each
  `package.json` (the app imports the API's types from
  `@arsw/todos-api/client`), each `wrangler.jsonc` (the Worker's `name`, the
  app's `services` binding) and the app's `env` type in `src/workers.d.ts`.
- Replace the `todos` domain in the API and the app with your own. It's there to
  copy from: one model, its operations and routes, and the page that lists,
  creates and deletes.

## License

[MIT](LICENSE)
