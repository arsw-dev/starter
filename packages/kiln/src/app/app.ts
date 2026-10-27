import { setDocumentInfo } from '#/document/document.info.ts';
import { notFound, onError } from '#/http/http.errors.ts';
import { toRouter } from '#/http/http.route.ts';
import { createRouter } from '#/http/http.router.ts';
import { toResponses } from '#/http/http.schemas.ts';

import type { DocumentInfo } from '#/document/document.info.ts';
import type { Middleware } from '#/http/http.middleware.ts';
import type { EnforceResponse, PolicyOption } from '#/http/http.policy.ts';
import type { AnyRoute } from '#/http/http.route.ts';
import type { AppEnv, Policy } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { MiddlewareHandler, Schema } from 'hono';
import type { ExtractSchema, MergePath, MergeSchemaPath } from 'hono/types';
import type { UnionToIntersection } from 'hono/utils/types';

// What a path mounts: a record of routes, and nothing else, so every route
// declares its responses and its policy
type Mounted = Record<string, AnyRoute>;

type Options<
  Given,
  Routes extends Record<string, Mounted>,
  PolicyNames extends string,
  PolicyReturn extends EnforceResponse<PolicyNames>,
> = {
  middleware?: (MiddlewareHandler<AppEnv> | Middleware)[];
  routes?: Routes;
  // The document's info, for kiln document
  document?: DocumentInfo;
} & PolicyOption<Given, PolicyNames, PolicyReturn>;

// The routes a path mounts, as a typed client sees them, as toRouter registers
// them
type SchemaOf<Routes extends Mounted> = SchemaOfRouter<
  Routes,
  ReturnType<typeof toRouter<Routes>>
>;

// The router is its own type argument, read only in a branch on Routes: so it
// waits for Routes to be known. Read where Routes is still generic, the
// router's schema is too, and Hono's ExtractSchema answers Schema
type SchemaOfRouter<Routes, Router> = Routes extends Mounted
  ? ExtractSchema<Router>
  : never;

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

// With a policy registered, createApp needs one; with none, it can be called
// with nothing
type OptionsArgs<
  Given,
  Routes extends Record<string, Mounted>,
  PolicyNames extends string,
  PolicyReturn extends EnforceResponse<PolicyNames>,
> = [Given] extends [never]
  ? [options?: Options<Given, Routes, PolicyNames, PolicyReturn>]
  : [options: Options<Given, Routes, PolicyNames, PolicyReturn>];

// An API's app: its middleware, in order, then its routes, so no route comes
// before a middleware, and its policy, enforced on every route. Its variables
// are the ones the API registers. Its type has every route given, for a typed
// client: a route added to the app afterwards would have none of this
const createApp = <
  const Routes extends Record<string, Mounted> = {},
  PolicyNames extends string = never,
  PolicyReturn extends EnforceResponse<PolicyNames> =
    EnforceResponse<PolicyNames>,
>(
  ...[options]: OptionsArgs<Policy, Routes, PolicyNames, PolicyReturn>
) => {
  const middleware = options?.middleware ?? [];
  const app = createRouter();

  // Hono takes a missing handler as a handler, so none means no call
  for (const entry of middleware) {
    app.use(typeof entry === 'function' ? entry : entry.handler);
  }

  for (const [path, mounted] of Object.entries<Mounted>(
    options?.routes ?? {},
  )) {
    app.route(path, toRouter(mounted, options?.policy));
  }

  // Every route the app registers runs after the middleware, so it can answer
  // with the middleware's errors: each route's definition gets them, beside
  // its own and the policy's, which win. The definition is the app's own copy,
  // but its responses are shared with the route itself, so they're replaced,
  // never changed
  const middlewareErrors = toResponses(
    Object.assign(
      {},
      ...middleware.map((entry) =>
        typeof entry === 'function' ? {} : entry.errors,
      ),
    ),
  );

  for (const definition of app.openAPIRegistry.definitions) {
    if (definition.type === 'route') {
      definition.route.responses = {
        ...middlewareErrors,
        ...definition.route.responses,
      };
    }
  }

  app.notFound(notFound);
  app.onError(onError);

  if (options?.document) setDocumentInfo(app, options.document);

  // app.route() returns each router's routes in its type, which a loop can't
  // carry: the routes are on the app, and RoutesSchema says which
  return app as OpenAPIHono<AppEnv, RoutesSchema<Routes>>;
};

export { createApp };
export type { OptionsArgs };
