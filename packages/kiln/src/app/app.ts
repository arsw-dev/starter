import { notFound, onError } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';

import type { Router } from '#/http/http.router.ts';
import type { AppEnv } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { MiddlewareHandler, Schema } from 'hono';
import type { MergePath, MergeSchemaPath } from 'hono/types';
import type { UnionToIntersection } from 'hono/utils/types';

// Each path's router gives its own schema, so a typed client sees its routes
type Routes<Schemas extends Record<string, Schema>> = {
  [Path in keyof Schemas]: OpenAPIHono<AppEnv, Schemas[Path], string>;
};

type Options<Schemas extends Record<string, Schema>> = {
  middleware?: MiddlewareHandler<AppEnv>[];
  routes?: Routes<Schemas>;
};

// Every router's schema under its path, as app.route() would merge them. The
// result is narrowed back to a Schema with infer: an intersection with Schema
// compiles, but makes every route unknown to the client. No routes given and an
// empty record both have none
type RoutesSchema<Schemas extends Record<string, Schema>> = [
  keyof Schemas,
] extends [never]
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

// An API's app: its middleware, in order, then its routes, so no route comes
// before a middleware. Its variables are the ones the API registers
const createApp = <const Schemas extends Record<string, Schema> = {}>({
  middleware = [],
  routes,
}: Options<Schemas> = {}) => {
  const app = createRouter();

  // Hono takes a missing handler as a handler, so none means no call
  for (const handler of middleware) app.use(handler);

  for (const [path, router] of Object.entries(routes ?? {})) {
    app.route(path, router);
  }

  app.notFound(notFound);
  app.onError(onError);

  // app.route() returns each router's routes in its type, which a loop can't
  // carry: the routes are on the app, and RoutesSchema says which
  return app as Router<AppEnv, RoutesSchema<Schemas>>;
};

export { createApp };
