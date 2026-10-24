# Changelog

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
