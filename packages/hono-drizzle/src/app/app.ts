import { database } from '#/db/db.ts';
import { notFound, onError } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';

import type { Binding, DB } from '#/db/db.ts';
import type { Router } from '#/http/http.router.ts';
import type { AppEnv } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { MiddlewareHandler, Schema } from 'hono';
import type { MergePath, MergeSchemaPath } from 'hono/types';
import type { UnionToIntersection } from 'hono/utils/types';

// Each path's router gives its own schema, so a typed client sees its routes.
// The record of every router is where Variables comes from: TypeScript infers
// only Schemas from the mapped type
type Routes<
  Variables extends object,
  Schemas extends Record<string, Schema>,
> = {
  [Path in keyof Schemas]: OpenAPIHono<
    AppEnv<Variables>,
    Schemas[Path],
    string
  >;
} & Record<string, OpenAPIHono<AppEnv<Variables>, Schema, string>>;

type Options<
  Variables extends object,
  Schemas extends Record<string, Schema>,
> = {
  db?: Binding;
  middleware?: MiddlewareHandler<AppEnv<Variables>>[];
  routes?: Routes<Variables, Schemas>;
};

// Every router's schema under its path, as app.route() would merge them. The
// result is narrowed back to a Schema with infer: an intersection with Schema
// compiles, but makes every route unknown to the client. No routes given
// (never) and an empty record ({}) both have none
type RoutesSchema<Schemas extends Record<string, Schema>> = [Schemas] extends [
  never,
]
  ? {}
  : [keyof Schemas] extends [never]
    ? {}
    : UnionToIntersection<
          {
            [Path in keyof Schemas & string]: MergeSchemaPath<
              Schemas[Path],
              MergePath<'/', Path>
            >;
          }[keyof Schemas & string]
        > extends infer S extends Schema
      ? S
      : never;

// An API's app: the database on every request when it has one, then its own
// middleware, in order, then its routes, so no route comes before a middleware.
// Variables is inferred from the routers and the middleware. Given explicitly,
// it can't be with routes, which TypeScript would then not infer: Schemas
// defaults to never, which makes routes an error rather than routes lost
const createApp = <
  Variables extends object = {
    db: DB;
  },
  const Schemas extends Record<string, Schema> = never,
>({ db, middleware = [], routes }: Options<Variables, Schemas> = {}) => {
  const app = createRouter<Variables>();

  if (db) app.use(database(db));

  // Hono takes a missing handler as a handler, so none means no call
  for (const handler of middleware) app.use(handler);

  for (const [path, router] of Object.entries(routes ?? {})) {
    app.route(path, router);
  }

  app.notFound(notFound);
  app.onError(onError);

  // app.route() returns each router's routes in its type, which a loop can't
  // carry: the routes are on the app, and RoutesSchema says which
  return app as Router<AppEnv<Variables>, RoutesSchema<Schemas>>;
};

export { createApp };
