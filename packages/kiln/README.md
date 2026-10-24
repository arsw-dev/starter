# @arsw/kiln

An API framework on [Hono](https://hono.dev), for Cloudflare Workers. An API
writes only what's its own: its routes, their success responses, and the errors
its code throws. Kiln owns everything it causes itself, the responses it sends
and their place in the OpenAPI document, so the document is the API's contract
and never leaves a response out.

```sh
pnpm add @arsw/kiln
```

Its peers: `hono`, `@hono/zod-openapi` and `zod`, and `drizzle-orm` for the
model only. It has three entries:

- `@arsw/kiln`: the app, its routes and middleware, and its errors. It runs in
  Workers.
- `@arsw/kiln/model`: models that give a [Drizzle](https://orm.drizzle.team)
  table on [D1](https://developers.cloudflare.com/d1/) and its
  [Zod](https://zod.dev) schemas from one list of fields. An API with no
  database installs and imports none of Drizzle.
- `@arsw/kiln/document`: writes the OpenAPI document, in Node.

Every app is an `OpenAPIHono`, so an API can always drop to Hono or
[zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
for something Kiln doesn't cover.

## The rule

Whoever produces a response declares it:

| Response                                             | Produced by          | Declared by                               |
| ---------------------------------------------------- | -------------------- | ----------------------------------------- |
| Success (200, 201, 204)                              | The handler          | The route                                 |
| The route's own errors (404 from `NotFound`)         | Its operations       | The route                                 |
| 422, with the issues                                 | The validation hook  | Kiln, when the route has a request schema |
| 400 (a body that isn't JSON), 415 (not sent as JSON) | Hono and zod-openapi | Kiln, when the route has a body           |
| 500                                                  | `onError`            | Kiln, on every route                      |
| A middleware's (401, 403)                            | The middleware       | The middleware, added to every route      |

A route can't declare one of Kiln's: it's a type error.

## The app

`createApp` gives an API's whole app: its middleware, its routes, and the
not-found and error handlers. `routes` maps each path to a record of routes, or
to a router:

```ts
// src/main.ts
import { createApp } from '@arsw/kiln';
import { database } from '@arsw/kiln/model';

import { todosRoutes } from './todos/todos.routes.ts';

export default createApp({
  middleware: [database((env) => env.DB), signedIn],
  routes: {
    '/todos': todosRoutes,
  },
});
```

`middleware` runs on every request, in order, before every route, so each one
can use what the ones before it set. One that answers, such as a 401, stops the
request there. The app's type has every route under its path, so a typed client
(`hc<typeof app>`) sees them all, with their bodies.

## Routes

A route is one object: its contract and its handler.

```ts
// src/todos/todos.routes.ts
import { defineRoute } from '@arsw/kiln';

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

It takes:

- `method` and `path`, with path parameters as `{id}`.
- The request's `params`, `query`, `headers` and `body`, each a schema. `body`
  is always required JSON, and is a schema, or `{ schema, description }` when
  the document should say what it is.
- The success `status`, 200 unless it says, with its `response` schema (none for
  a 204) and `description`.
- `errors`: each status the route's own code answers, and what it means here
  (`'Cannot find todo'`), which an error class can't know.
- The `handler`, typed from the rest: `c.req.valid()` by the request's schemas,
  `c.json()` by the declared statuses, and `c.var` by the registered variables.

Each route's key in its record is its `operationId` in the document. A record's
routes are registered in its key order, which matters only where paths overlap:
put `getNewTodo` (`/new`) before `getTodo` (`/{id}`), or `/new` reaches
`getTodo`.

## Middleware

A middleware that answers a request itself declares what it answers with, as a
route declares its errors:

```ts
import { defineMiddleware } from '@arsw/kiln';

const signedIn = defineMiddleware(
  async (c, next) => {
    // Answers a 401 or a 403, or sets the user
    c.set('user', user);

    return next();
  },
  {
    errors: {
      401: 'No token was sent',
      403: 'The token was refused',
    },
  },
);
```

`createApp` runs its handler like any other, and adds its errors to every route
in `routes`, records and routers alike, since each runs after it. A route that
declares one of the same statuses keeps its own description. The 500 is
`onError`'s, so a middleware can't declare it. The errors are for the document
only: a front end gets a non-OK response as an error carrying its status.

A middleware that only sets something, such as `database`, is a plain handler,
and adds no errors. `createMiddleware` is Hono's, typed by the registered
variables, for one written on its own.

## Variables

The variables a request carries are declared once, by adding them to Kiln's
`Register`, in a declaration file of their own:

```ts
// src/kiln.d.ts
import type { DB } from '@arsw/kiln/model';

declare module '@arsw/kiln' {
  interface Register {
    variables: {
      db: DB;
      user: User;
    };
  }
}
```

Every route, router and middleware reads them from there, so none takes a type
argument: `c.var.user` is a `User`, and `c.var.role`, never registered, is a
type error. With nothing registered, a request carries none. The app's
`src/main.ts` references the file, so anything that type-checks the app's type,
such as a front end's typed client, has them too:

```ts
// src/main.ts
/// <reference path="./kiln.d.ts" />
```

A D1 database is a middleware like any other, `database` from
`@arsw/kiln/model`, first so the rest can use `c.var.db`. It sets `db`, which an
API that uses it registers itself: Kiln doesn't, since a registration applies to
every API, those without a database too. Its bindings are typed by
`Cloudflare.Env`, which `wrangler types` writes. `AppEnv` is the env every
handler sees, for a function that takes a context.

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
  The route that throws it declares the status in its `errors`.

- **422**, `Invalid Request`, with `issues`: each one's `in` (`body`, `path`,
  `query`, … in OpenAPI's words), its `path` (`dueDate`, `tags.0`) and
  `message`. An unknown key is an issue of its own, at its own path.
- **An `HTTPException`**, Hono's, with its own status and message.
- **500** for anything else, `Internal Server Error`. The error itself is
  logged, never sent, as one object, so Workers Logs can filter on each field:
  `error` (its `name`, `message` and `stack`), `method`, `path` (without the
  query) and `rayId` (the `cf-ray` header). Nothing of the body or of who sent
  the request: a log must not carry personal data.

## Routes on a router

For anything a route can't say, a path takes a router instead of a record:
`createRouter()`, an `OpenAPIHono` whose routes are zod-openapi's or Hono's own,
and which answers a request its schemas refuse with the same 422. A route there
declares every response itself, with Kiln's pieces: `json(schema, description)`
for a JSON response, `errors({ 404: 'Cannot find todo' })` for its own errors,
and the responses `defineRoute` adds, `serverError` (the 500), `invalidRequest`
(the 422), `malformedBody` (the 400) and `unsupportedBody` (the 415):

```ts
const todosRouter = createRouter().openapi(
  createRoute({
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
  }),
  async (c) =>
    c.json(await todosOps.get(c.var.db, c.req.valid('param').id), 200),
);
```

Each status stays a key of its own, so the handler's `c.json(body, 404)` is
typed against it, and a client sees the body. `errorSchema` and `invalidSchema`
describe the errors' bodies. A middleware's errors reach a router's routes too.

An app with no `routes` can have middleware and routers chained onto it,
`createApp().use(handler).route('/', router)`, but a middleware's errors reach
only the routes given in `routes`. What `createApp` and `createRouter` return, a
`Router`, keeps `openapi` after `.use()`, where `OpenAPIHono`'s own type would
return a plain `Hono`.

## The model

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

## The document

From `@arsw/kiln/document`, in Node only, since it writes with `node:fs`, which
the core never imports. `writeDocument` writes an app's OpenAPI 3.1 document to
a file, indented and ending in a newline, to commit beside the API rather than
serve it:

```ts
// scripts/openapi.ts
import { writeDocument } from '@arsw/kiln/document';

import app from '#/main.ts';

await writeDocument(app, {
  title: 'Todos API',
  version: '1.0.0',
  file: new URL('../docs/openapi.json', import.meta.url),
});
```

`file` is a path or a URL.

## License

MIT
