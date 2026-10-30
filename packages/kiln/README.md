# @arsw/kiln

An API framework on [Hono](https://hono.dev), for Cloudflare Workers. An API
writes only what's its own: its routes, their success responses, the errors
their handlers return, and who may call each one. Kiln owns everything it causes
itself, the responses it sends and their place in the OpenAPI document, so the
document is the API's contract and never leaves a response out.

```sh
pnpm add @arsw/kiln
```

Its peers: `hono`, `@hono/zod-openapi` and `zod`, and `drizzle-orm` for the
model only. It has two entries and a command:

- `@arsw/kiln`: the app, its routes, middleware and policy. It runs in Workers.
- `@arsw/kiln/model`: models that give a [Drizzle](https://orm.drizzle.team)
  table on [D1](https://developers.cloudflare.com/d1/) and its
  [Zod](https://zod.dev) schemas from one list of fields. An API with no
  database installs and imports none of Drizzle.
- `kiln document`: writes the app's OpenAPI document, or checks it, in Node.

## The rule

Whoever produces a response declares it:

| Response                                             | Produced by                 | Declared by                               |
| ---------------------------------------------------- | --------------------------- | ----------------------------------------- |
| Success (200, 201, 204)                              | The handler                 | The route                                 |
| The route's errors (`notFound`, `conflict`)          | The handler, returning them | The route                                 |
| A middleware's (`unauthorized`)                      | The middleware              | The middleware, added to every route      |
| The policy's (`forbidden`)                           | `enforce`                   | The policy, added to every route          |
| 422, with the issues                                 | The validation hook         | Kiln, when the route has a request schema |
| 400 (a body that isn't JSON), 415 (not sent as JSON) | Hono and zod-openapi        | Kiln, when the route has a body           |
| 500                                                  | Anything thrown             | Kiln, on every route                      |

Each error is declared by name, beside the code that returns it, and the types
check one against the other: returning a name that isn't declared, and declaring
one that's never returned, are both type errors. A route can't declare one of
Kiln's.

## The app

`createApp` gives an API's whole app: its middleware, its policy, its routes,
the not-found and error handlers, and what its document says about it:

```ts
// src/main.ts
import { createApp } from '@arsw/kiln';
import { database } from '@arsw/kiln/model';

import { todosRoutes } from './todos/todos.routes.ts';

export default createApp({
  document: {
    title: 'Todos API',
    version: '1.0.0',
  },
  middleware: [database((env) => env.DB), signedIn],
  routes: {
    '/todos': todosRoutes,
  },
});
```

`middleware` runs on every request, in order, before every route, so each one
can use what the ones before it set. `routes` maps each path to a record of
routes, and nothing else.

The app's type has every route under its path, so a typed client
(`hc<typeof app>`) sees them all, with their bodies and their errors. It's an
`OpenAPIHono`, as `hc` needs, but adding routes to it after `createApp()` isn't
supported: they'd have none of Kiln's responses, errors or policy. What a route
can't say is a feature for `defineRoute`, not a reason to drop to zod-openapi.

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
    notFound: 'Cannot find todo',
  },
  handler: async (c, errors) => {
    const todo = await todosOps.get(c.var.db, c.req.valid('param').id);

    if (!todo) return errors.notFound();

    return c.json(todo, 200);
  },
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
- `errors`: each error the handler returns, by name, and what it means here.
- `policy`, when the API registers one: who may call it.
- The `handler`, typed from the rest: `c.req.valid()` by the request's schemas,
  `c.json()` by the declared statuses, `c.var` by the registered variables, and
  its last argument, `errors`, by the route's errors.

Each route's key in its record is its `operationId` in the document. A record's
routes are registered in its key order, which matters only where paths overlap:
put `getNewTodo` (`/new`) before `getTodo` (`/{id}`), or `/new` reaches
`getTodo`.

## Errors

An error is declared by name, with what it means where it's declared:

```ts
errors: {
  notFound: 'Cannot find todo',
  conflict: 'A todo with this title exists',
},
```

Each name is a status's reason phrase in camelCase, in RFC 9110's words:

| Status | Name                          | Status | Name                            |
| ------ | ----------------------------- | ------ | ------------------------------- |
| 400    | `badRequest`                  | 422    | `unprocessableContent` (Kiln's) |
| 401    | `unauthorized`                | 423    | `locked`                        |
| 402    | `paymentRequired`             | 424    | `failedDependency`              |
| 403    | `forbidden`                   | 425    | `tooEarly`                      |
| 404    | `notFound`                    | 426    | `upgradeRequired`               |
| 405    | `methodNotAllowed`            | 428    | `preconditionRequired`          |
| 406    | `notAcceptable`               | 429    | `tooManyRequests`               |
| 407    | `proxyAuthenticationRequired` | 431    | `requestHeaderFieldsTooLarge`   |
| 408    | `requestTimeout`              | 451    | `unavailableForLegalReasons`    |
| 409    | `conflict`                    | 500    | `internalServerError` (Kiln's)  |
| 410    | `gone`                        | 501    | `notImplemented`                |
| 411    | `lengthRequired`              | 502    | `badGateway`                    |
| 412    | `preconditionFailed`          | 503    | `serviceUnavailable`            |
| 413    | `contentTooLarge`             | 504    | `gatewayTimeout`                |
| 414    | `uriTooLong`                  | 505    | `httpVersionNotSupported`       |
| 415    | `unsupportedMediaType`        | 506    | `variantAlsoNegotiates`         |
| 416    | `rangeNotSatisfiable`         | 507    | `insufficientStorage`           |
| 417    | `expectationFailed`           | 508    | `loopDetected`                  |
| 421    | `misdirectedRequest`          | 510    | `notExtended`                   |
|        |                               | 511    | `networkAuthenticationRequired` |

`unprocessableContent` and `internalServerError` are always Kiln's, and
`badRequest` and `unsupportedMediaType` are on a route with a body: declaring
one there is a type error.

The handler gets a function for each declared error as its last argument.
`errors.notFound(message?)` answers `{ message }` with the name's status: the
message given, or the declared description. Its type is that status's typed JSON
response, so the handler's return type says which errors it answers, and a typed
client sees each one's body. The handler fails by **returning** an error, never
by throwing one:

- **A name that isn't declared** isn't on `errors`: returning it is a type
  error.
- **A name that's declared but never returned** is a type error at its
  declaration, which says so:
  `Type '"Cannot find todo"' is not assignable to type '"notFound is declared but never returned"'`.
- **Anything thrown**, by a handler, an operation, a middleware or the policy,
  is a 500, `Internal Server Error`. The error itself is logged, never sent, as
  one object, so Workers Logs can filter on each field: `error` (its `name`,
  `message` and `stack`), `method`, `path` (without the query) and `rayId` (the
  `cf-ray` header). Nothing of the body or of who sent the request: a log must
  not carry personal data.

So operations don't answer in HTTP. They return data, `undefined` for what isn't
there, or a result of their own, and the route decides which error that is:

```ts
const todosOps = {
  get: async (db: DB, id: string) =>
    db
      .select(todosModel.readColumns)
      .from(todosModel.table)
      .where(eq(todosModel.table.id, id))
      .get(),
};
```

Kiln's own errors are JSON with a `message` too:

- **404**, `Not Found`, for a path no route has.
- **422**, `Invalid Request`, with `issues`: each one's `in` (`body`, `path`,
  `query`, … in OpenAPI's words), its `path` (`dueDate`, `tags.0`) and
  `message`. An unknown key is an issue of its own, at its own path.
- **400** for a body that isn't JSON, and **415** for one not sent as JSON.

`errorSchema` and `invalidSchema` describe the error bodies, `issueSchema` an
issue, and `LOCATIONS` the names `in` takes, for a client that reads them.

## Middleware

A middleware that answers a request itself declares what it answers with, as a
route declares its errors, and gets them as its handler's last argument:

```ts
import { defineMiddleware } from '@arsw/kiln';

const signedIn = defineMiddleware({
  errors: {
    unauthorized: 'No token was sent',
    forbidden: 'The token was refused',
  },
  handler: async (c, next, errors) => {
    const token = c.req.header('authorization');

    if (!token) return errors.unauthorized();

    const user = await verify(token);

    if (!user) return errors.forbidden();

    c.set('user', user);

    return next();
  },
});
```

Returning an error ends the request there. Its errors are checked against what
the handler returns, as a route's are, and added to every route in the document,
since each runs after it. A route that declares one of the same statuses keeps
its own description. `defineMiddleware` is a function only so the handler can be
typed from its errors; `Middleware` is what it gives.

A middleware that only sets something, such as `database`, is a plain Hono
handler in the list, and adds no errors.

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

Every route and middleware reads them from there, so none takes a type argument:
`c.var.user` is a `User`, and `c.var.role`, never registered, is a type error.
With nothing registered, a request carries none. The app's `src/main.ts`
references the file, so anything that type-checks the app's type, such as a
front end's typed client, has them too:

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

## Policy

An API can have more than one kind of caller, and not every caller may use every
route. Each route says who may call it, with `policy`, and the app enforces that
before the route runs. The policy's type is registered beside the variables:

```ts
// src/kiln.d.ts
declare module '@arsw/kiln' {
  interface Register {
    variables: {
      user: User;
    };
    policy: {
      guests: 'none' | 'read' | 'write';
    };
  }
}
```

It's written to the document, so it's JSON: strings, numbers, booleans, `null`,
and arrays and plain objects of those. Registering anything else is a type
error.

**Kiln never reads what a policy means.** It could as well be a rate tier or an
audit flag: Kiln only passes each route's own to `enforce`, and writes it to the
document. Once one is registered, every route gives its policy, and one that
leaves it out is a type error, so no route is open by default:

```ts
const createTodo = defineRoute({
  method: 'post',
  path: '/',
  body: todosModel.createSchema,
  status: 201,
  response: todosModel.readSchema,
  description: 'Todo created',
  policy: {
    guests: 'none',
  },
  handler: async (c) =>
    c.json(await todosOps.create(c.var.db, c.req.valid('json')), 201),
});
```

`createApp`'s `policy` enforces it, and is needed once one is registered. Its
errors are declared by name, and `enforce(c, policy, errors)` gets the route's
own policy, never `undefined`, and a function for each error. It may be async,
and it refuses by returning an error; returning nothing lets the route run:

```ts
export default createApp({
  middleware: [signedIn],
  policy: {
    errors: {
      forbidden: 'The caller may not call this route',
    },
    enforce: (c, policy, errors) => {
      if (c.var.user.kind === 'guest' && policy.guests === 'none') {
        return errors.forbidden('Guests may not do this');
      }

      return undefined;
    },
  },
  routes: {
    '/todos': todosRoutes,
  },
});
```

Its errors are checked against what `enforce` returns, as a route's are. A
policy can be written inline, as here, or in a file of its own with
`definePolicy`, which takes the same object, checks it the same way, and gives
what `createApp`'s `policy` takes:

```ts
// src/policy.ts
import { definePolicy } from '@arsw/kiln';

const guestsPolicy = definePolicy({
  errors: {
    forbidden: 'The caller may not call this route',
  },
  enforce: (c, policy, errors) =>
    c.var.user.kind === 'guest' && policy.guests === 'none'
      ? errors.forbidden('Guests may not do this')
      : undefined,
});
```

It runs for every route, after the middleware, so `c.var` has what they set, and
before the route validates its request, so a refused caller gets the refusal,
never a 422 that shows the route's schema. Its errors are added to every route
in the document: a route's own description of a status wins over the policy's,
and the policy's over a middleware's. Each operation in the document carries its
route's policy as declared, as `x-policy`.

### A policy by parameter

Some routes need the policy to depend on what the caller sends: guests may set a
todo's priority to `low`, but only members may raise it. `paramPolicy` gives the
policy for some values of one parameter, and the route's `policy` holds for
every other:

```ts
const setPriority = defineRoute({
  method: 'put',
  path: '/{id}/priority',
  params: todosModel.paramsSchema,
  body: prioritySchema,
  response: todosModel.readSchema,
  description: 'Priority set',
  policy: {
    guests: 'none',
  },
  paramPolicy: {
    body: {
      priority: {
        low: {
          guests: 'write',
        },
      },
    },
  },
  handler: async (c, errors) => {
    // …
  },
});
```

It names one location (`params`, `query`, `headers` or `body`), one parameter of
the route's own schema there, and some of that parameter's values, each with its
policy. The parameter's values are string literals: an enum, a literal, or a
discriminated union's discriminator, whose values its options give. Any other
parameter, a value it can't take, a second parameter or a second location is a
type error. Like `policy`, it's there only when a policy is registered.

Before the route validates its request:

1. Kiln reads that one parameter, from the path, the query, the headers or the
   JSON body, and parses it with its own schema, so an omitted one with a
   default reads as its default.
2. A value the cases list gives that case's policy. Any other value, a missing
   or malformed one, or a body that isn't JSON, gives the route's `policy`.
3. `enforce` runs once, with that policy. A refusal answers then, so a refused
   caller never sees a 422.
4. The route's validators run as they would without it. The body is read once
   and cached, so they validate the same body.

Each operation with one carries it in the document beside `x-policy`, as
`x-param-policy`, with the parameter's location in OpenAPI's words (`path`,
`query`, `header`, `body`):

```json
{
  "in": "body",
  "name": "priority",
  "cases": {
    "low": {
      "guests": "write"
    }
  }
}
```

With no policy registered, a route can't give `policy` or `paramPolicy`,
`createApp` takes none, and no operation has `x-policy`.

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

A field can depend on another with `when`: it has a value exactly when the other
field has one of some values, and is NULL otherwise.

```ts
const todosModel = defineModel('todos', (field) => ({
  done: field.boolean({
    default: false,
    access: ['read', 'update'],
  }),
  completedOn: field.date({
    when: {
      done: true,
    },
    access: ['read'],
  }),
}));
```

`when` names one other field of the same model, an `enum` or a `boolean` that
isn't `optional`, and a value it can take, or a list of them
(`when: { status: ['closed', 'archived'] }`). Anything else is a type error, as
are `optional` and `default` beside it: the field allows NULL, and has no value
until the condition holds. It's held in both places, as every rule is:

- **A `CHECK`,** `completed_on_when_done`:
  `("done" IN (1)) = ("completed_on" IS NOT NULL)`. The field's own constraints
  still apply when it has a value.
- **`createSchema`** checks it on the whole request, with the other field's
  default when it isn't sent, and answers on the field's path: "Completed on is
  required when done is true", or "Completed on must be empty unless done is
  true". Only when the field is part of a create: one a create can't send (as
  here) is the operation's to set.
- **`updateSchema` doesn't check it.** An update may send half the pair, `done`
  without `completedOn`, and only the row has the other half, so the `CHECK` is
  what holds there: the operation that makes a todo done sets `completedOn` in
  the same write.

`readSchema` has the field nullable, as any optional field.

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

The app carries what its document says about it, `createApp`'s
`document: { title, version }`, and `kiln`, the package's command, writes it. In
Node only: it loads the app, which the core never does.

```sh
kiln document
```

loads the API's app, the default export of `src/main.ts` unless `--entry` says
otherwise, and writes its OpenAPI 3.1 document to `docs/openapi.json` unless
`--out` says otherwise, indented and ending in a newline, to commit beside the
API rather than serve it. An app without `document` fails, saying to add it.

```sh
kiln document --check
```

writes nothing. It fails when the file is missing or isn't the app's document,
naming the file and listing what differs, by where it is in the document: `+`
for what only the app's has, `-` for what only the file has, and `~` for what
differs.

As a package script, `"openapi": "kiln document"`, it serves each place the
document is kept up to date:

- **By hand**, after changing a route: `pnpm openapi`, then commit the file.
- **A pre-commit hook** that writes it and fails if that changed it, so the
  commit has it: `pnpm openapi && git diff --quiet -- docs/openapi.json`.
- **CI**, which writes nothing: `pnpm openapi --check`.

## License

MIT
