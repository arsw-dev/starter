# starter

A pnpm monorepo for Cloudflare Workers on Vite+. The README says what's here and
how to run it. This file holds what the code and its checks don't already say.

## Where things go

- `apps/`: front ends, `services/`: back ends (APIs, Workers), `packages/`:
  shared code, never deployed on its own.
- A front end and its API share a name and carry a suffix: `todos-app` and
  `todos-api`.
- Each Worker runs on its own, deployed and in development. A front end reaches
  its API only through a service binding, never by URL, and never by running the
  API inside its own dev server.
- Folders group files by what they are, and a helper lives in the folder that
  uses it. Tests go in a `tests/` folder beside the code they test.

## Writing code

Formatting, lint and the guardrails rules enforce the mechanical rules (exports,
arrow functions, import paths, object layout, blank lines, comments on disabled
rules), and each says how to fix what it catches. Run `vp check --fix` rather
than fixing by hand what it can fix. What no check enforces:

- **No build step.** TypeScript runs as it is: Node strips types, a Worker or an
  app is bundled only by its own deploy, and a package published to npm only by
  the release workflow (`.github/workflows/release.yml`). So imports use `#/`
  subpaths with `.ts` extensions, never directory imports, and no enums or other
  syntax that isn't erasable.
- **Comments explain why,** never what the code already says, and never point at
  a plan, a pull request or a date: they go stale.
- **Tests cover a unit's own decisions,** not what a framework, a library or a
  shared factory already guarantees; shared wiring is tested once, where it's
  defined. After writing a test, break the code it covers and see it fail.
- **Worker code is tested in workerd,** against real local bindings
  (`@cloudflare/vitest-plugin`).

## Dependencies

Every version comes from a catalog in `pnpm-workspace.yaml`, grouped by where
the code runs (`app`, `api`, `shared`, `tooling`). The exception is a published
package's peers: ranges from the oldest version its code needs, since `catalog:`
would publish an exact pin. `minimumReleaseAge` holds a release back for 3 days
and `trustPolicy` refuses one that drops its provenance; never add an exclusion
to get around either. Stop and ask before adding a dependency, a package, a tool
or config file, or a lint exemption.

## The API

- **A domain is one folder** (`src/todos/`): its model, its operations and its
  router.
- **The model is the only definition** of a table and its schemas: `defineModel`
  (`@arsw/hono-drizzle`) builds the Drizzle table, its `CHECK` constraints and
  the Zod schemas for reading, creating and updating, from one list of fields.
  Never write a table or a schema beside it. After changing a model, run
  `pnpm db:generate` and commit the migration.
- **Operations name the columns they read and return** (`readColumns`), so a new
  internal column never reaches a response.
- **Errors are types:** an operation throws `NotFound`, and the app's error
  handler answers. Every error is `{ message }`, and a request that fails its
  schema is a 422 with `{ message, issues }`.
- **Routes declare every response they can give,** so the OpenAPI document,
  committed as `docs/openapi.json`, is the API's contract.

## The app

- **Data goes through `defineApi`** (`@arsw/start-hono`): each server function
  is a top-level `const` (TanStack Start's compiler can't find one inside an
  object or a factory), its handler is `call(...)` over the binding, and the
  page uses the options `defineApi` builds.
- **A server function validates its input only when it reaches its own data**
  (KV, a secret, another service). One that calls an API leaves that to the API,
  which checks every request.
- **Loaders never await remote data.** A loader starts the read
  (`void queryClient.query(...).catch(noop)`); the page shows a skeleton for
  each section until its data arrives.
- **Forms come from `@arsw/hook-form-query`:** a schema built from its `z`
  helpers (separate schemas for create and update), `useFormMutation`, and its
  field components, each given the form's type. Errors the form catches show on
  their field; errors the server returns are toasts.
- **No memoizing by hand** (`useMemo`, `useCallback`, `memo`): the React
  Compiler does it.
- **State shared across the app is a Zustand store** in `src/stores/`.

## Changes

Conventional commits (`feat(todos-app): …`). One focused pull request per
change, from a branch off `main`; the hooks run the checks before every commit,
and never skip them with `--no-verify`.
