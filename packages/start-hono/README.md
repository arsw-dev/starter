# @arsw/start-hono

A [TanStack Start](https://tanstack.com/start) front end's way to its
[Hono](https://hono.dev) API over a Cloudflare service binding: typed calls,
query and mutation options for [TanStack Query](https://tanstack.com/query), and
errors that keep their meaning from the API to the page.

```sh
pnpm add @arsw/start-hono
```

Its peers: `@tanstack/react-start`, `@tanstack/react-router`,
`@tanstack/react-query`, `@tanstack/react-router-ssr-query` and `hono`.

## Calling the API

`connect` takes the binding and the API's type (`typeof app`, exported by the
API) and gives back `call`, which turns one typed request into a server
function's handler. It answers with the response's body, typed by the route, or
throws an `ApiError` carrying the status and, for a 422, the API's issues.

```ts
// src/api/api.server.ts
import { env } from 'cloudflare:workers';

import { connect } from '@arsw/start-hono/server';

import type { AppType } from 'my-api/client';

const call = connect<AppType>(() => env.MY_API, {
  name: 'my-api',
});

export { call };
```

```ts
// src/todos/todos.api.ts
const getAll = createServerFn({
  method: 'GET',
}).handler(call((client) => client.todos.$get()));

const todosApi = defineApi('todos', (api) => ({
  getAll: api.query(getAll),
  create: api.mutation(create, {
    invalidates: (): QueryKey[] => [todosApi.getAll.baseKey],
  }),
}));
```

Each server function is a top-level `const`: Start's compiler doesn't find one
inside an object or a factory.

## `defineApi`

Builds query and mutation options from server functions, keyed by where they
sit: `['todos', 'getAll']`, then the params when there are any. A definition
takes default options; a call site spreads its own over them.

- `todosApi.getAll()` gives options for `useQuery` or `queryClient.query`.
  `todosApi.getAll.baseKey` and `getQueryKey(params)` give its keys.
- `todosApi.create()` gives options for `useMutation`. What `invalidates` names
  is made stale before the call site's `onSuccess`, and the mutation stays
  pending until it's refetched.
- In the browser, a query takes at least 400ms and a mutation 250ms, so a
  loading state never flickers. `minDuration` sets a definition's own, or a
  mutation call site's.

## Setting up the app

```ts
// src/start.ts: same-origin server functions only, and ApiError across the wire
const startInstance = createStart(() => startOptions());

// src/router.tsx
const queryClient = createQueryClient({
  onServerError: (error) => {
    // a read the API failed on its side, in the browser: say so app-wide
  },
});

setupSsr(router, queryClient);
```

`createQueryClient`'s defaults: data refetched on every visit (`staleTime: 0`)
but kept on screen meanwhile, no retries on the server or for a 4xx, and up to
three in the browser otherwise. `setupSsr` streams queries from the server to
the browser, with an `ApiError` sent as it is rather than redacted.

## License

MIT
