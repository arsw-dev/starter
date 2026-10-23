# @arsw/hono-drizzle

A [Hono](https://hono.dev) API on Cloudflare Workers and
[D1](https://developers.cloudflare.com/d1/): OpenAPI routes that answer every
error in one shape, and models that give a [Drizzle](https://orm.drizzle.team)
table and its [Zod](https://zod.dev) schemas from one list of fields, so the
database and the API refuse the same values.

```sh
pnpm add @arsw/hono-drizzle
```

Its peers: `hono`, `@hono/zod-openapi`, `drizzle-orm` and `zod`.

## The app

`createApp` gives an API's whole app: a Drizzle database on every request
(`c.var.db`), its middleware, its routes, and the not-found and error handlers.
`db` says which of the Worker's bindings is its D1 database. The bindings are
typed by `Cloudflare.Env`, which `wrangler types` writes. `routes` maps each
path to a router:

```ts
// src/main.ts
import { createApp } from '@arsw/hono-drizzle';

import { todosRouter } from './todos/todos.router.ts';

export default createApp({
  db: (env) => env.DB,
  routes: {
    '/': todosRouter,
  },
});
```

The app's type has every router's routes under its path, so a typed client
(`hc<typeof app>`) sees them all. Each router starts from `createRouter`, which
answers a request its route's schemas refuse with a 422.

`db` is optional: an API with no D1 database leaves it out. A request's
variables are `{ db: DB }` unless an API declares its own, all of them, to
`createRouter` and `AppEnv`; one with no database leaves `db` out, and
`c.var.db` is then a type error rather than `undefined`. An auth guard, say:

```ts
type Variables = {
  db: DB;
  user: User;
};

const signedIn = createMiddleware<AppEnv<Variables>>(async (c, next) => {
  // Answers a 401, or sets the user
  c.set('user', user);

  return next();
});

const todosRouter = createRouter<Variables>();

export default createApp({
  db: (env) => env.DB,
  middleware: [signedIn],
  routes: {
    '/': todosRouter,
  },
});
```

`createApp` takes no type arguments: it infers `Variables` from the routers and
the middleware, so a middleware written inline is typed by the routers it runs
before. `middleware` runs on every request, in order, after the database and
before every route, so each one can use the database and what the ones before it
set. One that answers, such as a 401, stops the request there.

An app with no `routes` can still be given its variables,
`createApp<Variables>()`, and have middleware and routes chained onto it:
`createApp<Variables>().use(signedIn).route('/', todosRouter)`. What `createApp`
and `createRouter` return keeps `openapi` after `.use()`, where `OpenAPIHono`'s
own type would return a plain `Hono`. With `routes`, give no type arguments:
TypeScript can't infer the routes beside one that's given, so
`createApp<Variables>({ routes })` is a type error rather than routes the client
can't see.

## Errors

Every error is JSON with a `message`:

- **404**, for a path no route has, or when a handler throws `NotFound`.
- **422**, `Invalid Request`, with `issues`: each one's `in` (`body`, `path`,
  `query`, … in OpenAPI's words), its `path` (`dueDate`, `tags.0`) and
  `message`. An unknown key is an issue of its own, at its own path.
- **An `HTTPException`**, with its own status and message.
- **500** for anything else, `Internal Server Error`: the error itself is
  logged, never sent.

`json(schema, description)` declares a JSON response, and
`errors({ 404: 'Cannot find todo' })` a route's errors: each status's
description, with an error body. Each status stays a key of its own, so a
handler's `c.json(body, 404)` is typed against it, and a client sees the body. A
422's body has its `issues`, so it's `json(invalidSchema, description)`.
`errorSchema` and `invalidSchema` describe the errors' bodies, and `serverError`
(the 500) and `malformedBody` (the 400 a body that isn't JSON gets) can be
spread into any route's responses:

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
    422: json(invalidSchema, 'The id must be a uuid'),
    ...serverError,
  },
});
```

## Models

`createDefineModel` sets how an API's tables are stored (`casing`, `snake_case`
unless set to `camelCase`), once. `defineModel` takes a table's name and its
fields:

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
