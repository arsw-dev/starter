import { OpenAPIHono } from '@hono/zod-openapi';

import { notFound, onError } from '#/http/http.errors.ts';
import { toRouter } from '#/http/http.route.ts';
import { createRouter } from '#/http/http.router.ts';

import type { AnyRoute } from '#/http/http.route.ts';
import type { Router } from '#/http/http.router.ts';
import type { AppEnv } from '#/http/http.types.ts';
import type { MiddlewareHandler, Schema } from 'hono';
import type { ExtractSchema, MergePath, MergeSchemaPath } from 'hono/types';
import type { UnionToIntersection } from 'hono/utils/types';

// What a path mounts: a record of routes, or a router, for anything a route
// can't say
type Mounted = Record<string, AnyRoute> | OpenAPIHono<AppEnv, Schema, string>;

type Options<Routes extends Record<string, Mounted>> = {
  middleware?: MiddlewareHandler<AppEnv>[];
  routes?: Routes;
};

// The routes a path mounts, as a typed client sees them: a record's, as
// toRouter registers them, or a router's own
type SchemaOf<Routes> = SchemaOfRouter<
  Routes,
  ReturnType<typeof toRouter<Extract<Routes, Record<string, AnyRoute>>>>
>;

// The router is its own type argument, read only in a branch on Routes: so it
// waits for Routes to be known. Read where Routes is still generic, the
// router's schema is too, and Hono's ExtractSchema answers Schema
type SchemaOfRouter<Routes, Router_> =
  Routes extends Record<string, AnyRoute>
    ? ExtractSchema<Router_>
    : ExtractSchema<Routes>;

// Every path's routes under its path, as app.route() would merge them. The
// result is narrowed back to a Schema with infer: an intersection with Schema
// compiles, but makes every route unknown to the client. No routes given and an
// empty record both have none
type RoutesSchema<Routes extends Record<string, Mounted>> = [
  keyof Routes,
] extends [never]
  ? {}
  : UnionToIntersection<
        {
          [Path in keyof Routes & string]: MergeSchemaPath<
            SchemaOf<Routes[Path]>,
            MergePath<'/', Path>
          >;
        }[keyof Routes & string]
      > extends infer S extends Schema
    ? S
    : never;

// An API's app: its middleware, in order, then its routes, so no route comes
// before a middleware. Its variables are the ones the API registers
const createApp = <const Routes extends Record<string, Mounted> = {}>({
  middleware = [],
  routes,
}: Options<Routes> = {}) => {
  const app = createRouter();

  // Hono takes a missing handler as a handler, so none means no call
  for (const handler of middleware) app.use(handler);

  for (const [path, mounted] of Object.entries(routes ?? {})) {
    app.route(
      path,
      mounted instanceof OpenAPIHono ? mounted : toRouter(mounted),
    );
  }

  app.notFound(notFound);
  app.onError(onError);

  // app.route() returns each router's routes in its type, which a loop can't
  // carry: the routes are on the app, and RoutesSchema says which
  return app as Router<AppEnv, RoutesSchema<Routes>>;
};

export { createApp };
