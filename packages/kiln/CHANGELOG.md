# Changelog

## 0.2.1

A rule across two fields, and a policy that depends on what the caller sends.

### Added

- **`when`, on a field:** `when: { done: true }` gives the field a value exactly
  when another field of the model, an `enum` or a `boolean` that isn't
  `optional`, has that value, or one of a list. The field allows NULL. A `CHECK`
  holds it (`<column>_when_<other column>`), and `createSchema` checks it on the
  whole request, the other field's default counting, with an issue on the
  field's path. `updateSchema` leaves it to the `CHECK`, since an update may
  send half the pair. Naming anything else, a value the field can't take, or
  `optional` or a `default` beside it, is a type error.
- **`paramPolicy`, on `defineRoute`:** the policy for some values of one
  parameter (`params`, `query`, `headers` or `body`) of the route's own schema,
  whose values are string literals, a discriminated union's discriminator among
  them. Before validation, Kiln reads and parses that one parameter, picks its
  case's policy or the route's `policy`, and runs `enforce` once with it, so a
  refused caller still never sees a 422. The document carries it beside
  `x-policy`, as `x-param-policy`: `{ in, name, cases }`.

## 0.2.0

Every response the document lists is one the code it's declared beside produces,
and the types check the two against each other. Errors are values, declared by
name and returned from the handler; every route gives its policy once an API
registers one; routes are the only thing an app mounts; and the app carries its
document's details, which the `kiln` command writes and checks.

### Breaking

- **Errors are returned by name.** A route, a middleware and the policy declare
  their errors by name, `errors: { notFound: 'Cannot find todo' }`, where they
  were by status. The handler gets a function for each as its last argument,
  `handler: (c, errors) => …`, and fails by returning one:
  `return errors.notFound()` answers `{ message }` with the declared
  description, or the message given. Returning a name that isn't declared, and
  declaring one that's never returned, are type errors. A route's handler no
  longer gets `next`.
- **`HttpError`, `Unauthorized`, `Forbidden`, `NotFound` and `Conflict` are
  removed.** Anything a handler, middleware, operation or the policy throws is a
  500, logged as before. Operations return data, or `undefined`, and the route
  says which error that is. An `HTTPException` is a 500 too, but for Kiln's own
  400 and 415.
- **`defineMiddleware` takes one object,** `{ errors, handler }`, whose handler
  gets the errors as its last argument; a middleware that only sets something is
  a plain Hono handler in the list. `createMiddleware` is removed.
- **`access` is `policy`,** and `Access` is `Policy`, read from
  `Register['policy']`. A registered policy is JSON, since it's written to the
  document; anything else is a type error. Once one is registered, every route
  gives its policy: leaving it out is a type error.
- **`createApp`'s `policy` replaces `authorize`,** and `defineAuthorize` and
  `Authorize` are removed: `policy: { errors, enforce }`, needed once a policy
  is registered and refused when none is. `enforce(c, policy, errors)` gets the
  route's own policy, never `undefined`, and refuses by returning an error. It
  runs for every route. Written inline, or in a file of its own with
  `definePolicy({ errors, enforce })`, it's checked the same way.
- **Routers are removed.** `routes` maps each path to a record of routes only.
  `createRouter`, `Router`, `json`, `errors`, `invalidRequest`, `serverError`,
  `malformedBody` and `unsupportedBody` are no longer exported, nor `notFound`,
  `onError` and `toErrorResponse`, which only an app assembled by hand used.
  `errorSchema`, `invalidSchema`, `issueSchema` and `LOCATIONS` still are.
- **`writeDocument` and `@arsw/kiln/document` are removed,** for `createApp`'s
  `document` and the `kiln document` command.
- **`createApp` returns the app as before, an `OpenAPIHono`,** since a typed
  client (`hc`) and `@arsw/start-hono`'s `connect` both take only a Hono app.
  Routes added to it afterwards aren't supported: they'd have none of Kiln's
  responses, errors or policy. Without `.use()` to chain, its type no longer
  needs a class of its own.
- **`ErrorStatus` and `ErrorDescriptions` are no longer exported,** and
  `DocumentOptions` is removed. `ErrorName`, `Errors` and `ErrorResponse` type
  errors by name, `AppPolicy` what `definePolicy` gives, and `DocumentInfo` the
  document's details.

### Added

- **`createApp`'s `document`,** `{ title, version }`: the document's `info`.
- **`kiln document`,** the package's command, in Node: it loads the API's app
  (`src/main.ts`, or `--entry`) and writes its OpenAPI 3.1 document to
  `docs/openapi.json` (or `--out`). With `--check`, it writes nothing, and fails
  when the file is missing or stale, naming it and listing what differs.
- **`x-policy`:** with a policy registered, each operation in the document
  carries its route's policy as declared.

## 0.1.1

A route says who may call it, and the app checks that before the route runs.

### Added

- **`access` in `Register`:** the type of a route's rule, declared by an API
  beside its variables. Without it, a route can't set `access`.
- **`defineRoute`'s `access`:** the route's rule, which Kiln never reads.
- **`defineAuthorize(check, { errors })`:** a check that gets each route's
  `access`, or `undefined` for a route that sets none, and refuses by throwing
  an `HttpError`. It may be async. `Authorize` is its type, and `Access` the
  registered rule's.
- **`createApp`'s `authorize`:** runs the check for every route in a record,
  after the middleware and before the route validates its request, and adds the
  check's errors to each of those routes in the document. A router given in
  `routes` isn't checked.

## 0.1.0

Kiln becomes a framework: an API writes only what's its own, its routes, their
success responses and the errors its code throws, and Kiln declares every
response it causes. Whoever produces a response declares it, so the OpenAPI
document never leaves one out.

### Breaking

- **Variables are registered, not passed:** `createRouter<Variables>()`,
  `createApp<Variables>()` and `AppEnv<Variables>` take no type argument now. An
  API adds its variables to `Register` once, and every router, route and
  middleware reads them:

  ```ts
  declare module '@arsw/kiln' {
    interface Register {
      variables: { db: DB };
    }
  }
  ```

  The model doesn't register `db`: an API that uses the database registers it
  itself.

- **`createApp`'s `routes` take records of routes:** each path maps to a record
  of `defineRoute`s, or to a router as before. A router written with
  `.basePath('/todos')` and mounted at `/` becomes a record mounted at `/todos`.
- **`NotFound` is an `HttpError`:** it still answers a 404 with its message.
  `toErrorResponse` reads the status from any `HttpError`.
- **A 500's log is one object,**
  `{ error: { name, message, stack }, method, path, rayId }`, where it was the
  `Error` itself.

### Added

- **`defineRoute`:** a route as one object, its contract and its handler, typed
  from the rest. Kiln adds a 500 to every route, a 422 to one with a request
  schema, and a 400 and a 415 to one with a body. A route can't declare those:
  it's a type error. A record's key is its route's `operationId`, and its routes
  register in key order.
- **`defineMiddleware(handler, { errors })`:** a middleware that declares the
  errors it answers with. `createApp` adds them to every route it registers, and
  a route's own description of a status wins. `Middleware` is its type.
- **`HttpError`,** the base of the errors an API throws on purpose, with
  `Unauthorized` (401), `Forbidden` (403) and `Conflict` (409) beside
  `NotFound`. An API adds its own with a class that names its status.
- **`createMiddleware`,** Hono's, typed by the registered variables.
- **`@arsw/kiln/document`:** `writeDocument(app, { title, version, file })`
  writes the OpenAPI 3.1 document, in Node.
- **For routes on a router:** `invalidRequest` (the 422) and `unsupportedBody`
  (the 415), beside `serverError` and `malformedBody`.
- **Types:** `Register`, `Variables`, `ErrorStatus`, `ErrorDescriptions`,
  `Middleware` and `DocumentOptions`.

## 0.0.0

`@arsw/hono-drizzle` 0.1.3, under a new name, with Drizzle moved to
`@arsw/kiln/model`: `createDefineModel`, `field`, `idSchema`, `timestampSchema`,
`database` and the `Binding` and `DB` types. The core, `@arsw/kiln`, imports
none of Drizzle, so `drizzle-orm` is an optional peer, needed only for the
model.

Two changes follow from the move. `createApp` no longer takes `db`: the database
is a middleware, first in the list so the rest can use it,
`middleware: [database((env) => env.DB)]`. And a request's variables are `{}`
unless an API declares them, where they were `{ db: DB }`, so an API with a
database declares `{ db: DB }` to `createRouter` and `AppEnv`. `Router`, the
class `createApp` and `createRouter` return, is exported too.
