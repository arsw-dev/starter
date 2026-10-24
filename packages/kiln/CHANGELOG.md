# Changelog

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
