# Changelog

## 0.1.3

`errors({ 404: 'Cannot find todo' })` declares a route's errors by status, each
an error body with its description, as `json(errorSchema, description)` would.
And `createApp` takes `routes`, each path's router, registered after the
middleware: an API's whole wiring is one call, and its type has every route, for
a typed client. With `routes`, `createApp` takes no type arguments: it infers
`Variables` from the routers and the middleware.

## 0.1.2

`createApp` takes `middleware`: an API's own, run on every request in order,
after the database and before its routes. And `.use()` on what `createApp` and
`createRouter` return keeps its type: the chain still has `openapi`, and can be
passed where an `OpenAPIHono` is expected.

## 0.1.1

`createApp`'s `db` is optional: an API with no D1 database leaves it out. And an
API can declare the variables its requests carry, such as a signed-in user, with
`createApp<Variables>()`, `createRouter<Variables>()` and `AppEnv<Variables>`.
They're `{ db: DB }` unless it says otherwise, so an API that already uses them
changes nothing.

## 0.1.0

The first release: `createApp` and `createRouter`, one error shape (`NotFound`,
the 422's issues, a 500 that says nothing), `json`, `serverError` and
`malformedBody` for routes, and `createDefineModel`, whose models give a D1
table, its columns and its read, create, update and params schemas.
