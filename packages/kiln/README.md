# @arsw/kiln

An API framework on [Hono](https://hono.dev), for Cloudflare Workers: OpenAPI
routes that answer every error in one shape, wired into one app. Under
`@arsw/kiln/model`, models that give a [Drizzle](https://orm.drizzle.team) table
on [D1](https://developers.cloudflare.com/d1/) and its [Zod](https://zod.dev)
schemas from one list of fields, so the database and the API refuse the same
values.

```sh
pnpm add @arsw/kiln
```

Its peers: `hono`, `@hono/zod-openapi` and `zod`, and `drizzle-orm` for
`@arsw/kiln/model` only. An API with no database installs and imports none of
Drizzle.

## The app

`createApp` gives an API's whole app: its middleware, its routes, and the
not-found and error handlers. `routes` maps each path to a record of routes, or
to a router:

```ts
// src/main.ts
import { createApp } from '@arsw/kiln';

import { todosRoutes } from './todos/todos.routes.ts';

export default createApp({
  routes: {
    '/todos': todosRoutes,
  },
});
```

The app's type has every route under its path, so a typed client
(`hc<typeof app>`) sees them all.

### Routes

A route is one object: its contract and its handler. It declares only what's its
own, its success response and the errors its code throws:

```ts
const getTodo = defineRoute({
  method: 'get',
  path: '/{id}',
  params: todosModel.paramsSchema,
  response: todosModel.readSchema,
  description: 'One todo',
  errors: {
    404: 'Cannot find todo',
  },
  handler: async (c) =>
    c.json(await todosOps.get(c.var.db, c.req.valid('param').id), 200),
});

const todosRoutes = {
  getTodo,
  getAllTodos,
  createTodo,
};
```

It takes `method` and `path`, the request's `params`, `query`, `headers` and
`body`, the success `status` (200 unless it says) with its `response` schema
(none for a 204) and `description`, its `errors`, each status's description, and
the `handler`. `body` is a schema, or `{ schema, description }`, and is always
required JSON. The handler is typed from the rest: `c.req.valid()` by the
request's schemas, `c.json()` by the declared statuses, and `c.var` by what's
registered.

Kiln declares the responses it causes itself, so a route can't:

- **500**, on every route, which `onError` sends for anything unexpected.
- **422**, on a route with any request schema, which the validation hook sends
  with the issues.
- **400** and **415**, on a route with a body: one that isn't valid JSON, or
  isn't sent as JSON.

Each route's key in its record is its `operationId`. A record's routes are
registered in its key order, which matters only where paths overlap: put
`getNewTodo` (`/new`) before `getTodo` (`/{id}`), or `/new` reaches `getTodo`.

For anything a route can't say, a path takes a router instead: `createRouter()`,
an `OpenAPIHono` whose routes are Hono's or zod-openapi's own, and which answers
a request its schemas refuse with the same 422.

`middleware` runs on every request, in order, before every route, so each one
can use what the ones before it set. One that answers, such as a 401, stops the
request there.

### Variables

The variables a request carries are declared once, by adding them to Kiln's
`Register`:

```ts
declare module '@arsw/kiln' {
  interface Register {
    variables: {
      db: DB;
      user: User;
    };
  }
}
```

Every router, route and middleware reads them from there, so none takes a type
argument: `c.var.user` is a `User`, and `c.var.role`, never registered, is a
type error. With nothing registered, a request carries none. Declare it in the
file with the app (`src/main.ts`): anything that type-checks the app's type,
such as a front end's typed client, then has it too.

A D1 database is a middleware like any other, `database` from
`@arsw/kiln/model`, first so the rest can use `c.var.db`. It sets `db`, which an
API that uses it registers itself: Kiln doesn't, since a registration applies to
every API, those without a database too. Its bindings are typed by
`Cloudflare.Env`, which `wrangler types` writes. With an auth guard, say:

```ts
import { createApp, createMiddleware } from '@arsw/kiln';
import { database } from '@arsw/kiln/model';

const signedIn = createMiddleware(async (c, next) => {
  // Answers a 401, or sets the user
  c.set('user', user);

  return next();
});

export default createApp({
  middleware: [database((env) => env.DB), signedIn],
  routes: {
    '/todos': todosRoutes,
  },
});
```

`createMiddleware` is Hono's, typed by what's registered. `AppEnv` is the env
every router and handler sees, for a function that takes a context.

An app with no `routes` can have middleware and routers chained onto it:
`createApp().use(signedIn).route('/', router)`. What `createApp` and
`createRouter` return, a `Router`, keeps `openapi` after `.use()`, where
`OpenAPIHono`'s own type would return a plain `Hono`.

## Errors

Every error is JSON with a `message`:

- **404**, `Not Found`, for a path no route has.
- **An `HttpError`**, thrown by a handler or an operation, with its own status
  and message: `Unauthorized` (401), `Forbidden` (403), `NotFound` (404) and
  `Conflict` (409), or a class of an API's own, which names its status once:

  ```ts
  class Gone extends HttpError {
    override name = 'Gone';
    readonly status = 410;
  }

  throw new Gone('Todo was archived');
  ```

  Its status is any client or server error but 422, whose body has its issues.

- **422**, `Invalid Request`, with `issues`: each one's `in` (`body`, `path`,
  `query`, … in OpenAPI's words), its `path` (`dueDate`, `tags.0`) and
  `message`. An unknown key is an issue of its own, at its own path.
- **An `HTTPException`**, Hono's, with its own status and message.
- **500** for anything else, `Internal Server Error`: the error itself is
  logged, never sent.

A route on a router declares every response itself, with Kiln's pieces.
`json(schema, description)` declares a JSON response, and
`errors({ 404: 'Cannot find todo' })` a route's errors: each status's
description, with an error body. Each status stays a key of its own, so a
handler's `c.json(body, 404)` is typed against it, and a client sees the body.
`errorSchema` and `invalidSchema` describe the errors' bodies, and the responses
`defineRoute` adds can be spread in: `serverError` (the 500), `invalidRequest`
(the 422), `malformedBody` (the 400) and `unsupportedBody` (the 415):

```ts
const getTodoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: todosModel.paramsSchema,
  },
  responses: {
    200: json(todosModel.readSchema, 'One todo'),
    ...errors({
      404: 'Cannot find todo',
    }),
    ...invalidRequest,
    ...serverError,
  },
});
```

## Models

From `@arsw/kiln/model`. `createDefineModel` sets how an API's tables are stored
(`casing`, `snake_case` unless set to `camelCase`), once. `defineModel` takes a
table's name and its fields:

```ts
// src/db/db.ts
const defineModel = createDefineModel();

// src/todos/todos.model.ts
const todosModel = defineModel('todos', (field) => ({
  title: field.text({
    notBlank: true,
    maxLength: 200,
    access: 'all',
  }),
  done: field.boolean({
    default: false,
    access: ['read', 'update'],
  }),
  estimate: field.number({
    type: 'integer',
    gte: 1,
    optional: true,
    access: 'all',
  }),
}));

// drizzle-kit only finds a table exported on its own
const todosTable = todosModel.table;
```

The kinds are `text` (trimmed unless `trim: false`; `notBlank`, `maxLength`),
`number` (`integer` or `real`; `gt`, `gte`, `lt`, `lte`), `boolean`, `enum` and
`date` (a calendar date, `YYYY-MM-DD`). Each takes `optional` (the column allows
NULL), `default`, and `access`: `'all'`, or which of `read`, `create` and
`update` the field is part of. Every rule is both a `CHECK` on the column, so a
write that bypasses the API can't break it, and a rule in the schema, so the API
answers a 422 before the database would fail with a 500.

Every model also has `pk` (an integer key, for joins, that never leaves the
database), `id` (a v4 uuid, for clients), and `createdAt` and `updatedAt` (ISO
timestamps in UTC, set by the database). A model gives:

- `table`, the Drizzle table, and `columns`, all of its columns.
- `readColumns`: what a read returns, for `select()` and `returning()`, so `pk`
  and fields without `read` stay in the database.
- `readSchema`, `createSchema` (strict: unknown keys are refused) and
  `updateSchema` (strict, and at least one field).
- `paramsSchema`: `{ id }`, a uuid.

`DB` is the database's type, for functions that take one; `idSchema` and
`timestampSchema` are the schemas `id` and the timestamps use.

## License

MIT
