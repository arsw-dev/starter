import { z } from '@hono/zod-openapi';

import { toErrors } from './http.errors.ts';
import { toPolicyMiddleware } from './http.policy.ts';
import { createRouter } from './http.router.ts';
import {
  bodyErrors,
  invalidRequest,
  json,
  serverError,
  toResponses,
} from './http.schemas.ts';

import type {
  Declaration,
  Errors,
  KilnErrorName,
  StatusOf,
} from './http.errors.ts';
import type { AnyPolicy } from './http.policy.ts';
import type { ErrorDeclaration, invalidSchema } from './http.schemas.ts';
import type { AppEnv, Policy } from './http.types.ts';
import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type {
  ContentlessStatusCode,
  SuccessStatusCode,
} from 'hono/utils/http-status';
import type { Simplify } from 'hono/utils/types';

// A body as a route gives it: its schema, or its schema and what it is
type BodyInput =
  | z.ZodType
  | {
      schema: z.ZodType;
      description: string;
    };

type JsonDeclaration<Schema extends z.ZodType> = ReturnType<
  typeof json<Schema>
>;

type BodySchema<Body> = Body extends z.ZodType
  ? Body
  : Body extends {
        schema: infer Schema extends z.ZodType;
      }
    ? Schema
    : never;

// Every request schema a route has, under zod-openapi's names
type RequestOf<Params, Query, Headers, Body> = Simplify<
  (Params extends z.ZodType
    ? {
        params: Params;
      }
    : {}) &
    (Query extends z.ZodType
      ? {
          query: Query;
        }
      : {}) &
    (Headers extends z.ZodType
      ? {
          headers: Headers;
        }
      : {}) &
    (Body extends BodyInput
      ? {
          body: {
            required: true;
            content: {
              'application/json': {
                schema: BodySchema<Body>;
              };
            };
          };
        }
      : {})
>;

// The route's own responses, then Kiln's: the 500 onError sends, the 422 the
// router's validation hook sends when there's a request schema, and with a
// body, the 400 Hono's validator sends for one that isn't JSON and the 415
// zod-openapi sends for one that isn't sent as JSON
type ResponsesOf<
  Status extends number,
  Response,
  Names extends string,
  Request,
  Body,
> = Simplify<
  {
    [Code in Status]: Code extends ContentlessStatusCode
      ? {
          description: string;
        }
      : Response extends z.ZodType
        ? JsonDeclaration<Response>
        : {
            description: string;
          };
  } & {
    [Code in StatusOf<Names>]: ErrorDeclaration;
  } & {
    500: ErrorDeclaration;
  } & ([keyof Request] extends [never]
      ? {}
      : {
          422: JsonDeclaration<typeof invalidSchema>;
        }) &
    (Body extends BodyInput
      ? {
          400: ErrorDeclaration;
          415: ErrorDeclaration;
        }
      : {})
>;

// The names Kiln answers on a route, which the route itself can't declare
type KilnNameOf<Body> =
  | KilnErrorName
  | (Body extends BodyInput ? 'badRequest' | 'unsupportedMediaType' : never);

// A route's policy, with a policy registered and only then
type PolicyField<Given> = [Given] extends [never]
  ? {
      policy?: never;
    }
  : {
      policy: Given;
    };

// What zod-openapi lets a route's handler see
type ContextOf<Config extends RouteConfig> = Parameters<
  RouteHandler<Config, AppEnv>
>[0];

// And answer: its typed responses, and a plain Response for a route with one
// that has no body. zod-openapi's own type takes a promise of one or of the
// other, never of both, as an async handler that answers both returns
type ResponseOf<Config extends RouteConfig> =
  | Awaited<ReturnType<RouteHandler<Config, AppEnv>>>
  | Promise<Awaited<ReturnType<RouteHandler<Config, AppEnv>>>>;

// A route as zod-openapi registers it, its handler, and its policy
type Route<Config extends RouteConfig = RouteConfig> = {
  route: Config;
  handler: (c: ContextOf<Config>) => ResponseOf<Config>;
  policy?: Policy;
};

// Any route, whatever its handler: a handler is typed by its own route, so
// none fits another's
type AnyRoute = {
  route: RouteConfig;
  handler: unknown;
  policy?: Policy;
};

type RouteOf<
  Method extends RouteConfig['method'],
  Path extends string,
  Params,
  Query,
  Headers,
  Body,
  Status extends number,
  Response,
  Names extends string,
> = {
  method: Method;
  path: Path;
  request: RequestOf<Params, Query, Headers, Body>;
  responses: ResponsesOf<
    Status,
    Response,
    Names,
    RequestOf<Params, Query, Headers, Body>,
    Body
  >;
};

// The body as zod-openapi takes it: required JSON, with its description when
// it has one
const toBody = (body: BodyInput) => {
  const { schema, ...described } =
    body instanceof z.ZodType
      ? {
          schema: body,
        }
      : body;

  return {
    required: true,
    ...described,
    content: {
      'application/json': {
        schema,
      },
    },
  };
};

// A route, as one object: its contract and its handler, typed from the rest.
// Kiln adds the responses it causes itself, and a route can't declare those.
// The handler gets the route's errors as its last argument, and answers one by
// returning it
const defineRoute = <
  const Method extends RouteConfig['method'],
  const Path extends string,
  Params extends z.ZodType | undefined = undefined,
  Query extends z.ZodType | undefined = undefined,
  Headers extends z.ZodType | undefined = undefined,
  Body extends BodyInput | undefined = undefined,
  Status extends SuccessStatusCode = 200,
  Response extends z.ZodType | undefined = undefined,
  Names extends string = never,
  Return extends ResponseOf<
    RouteOf<Method, Path, Params, Query, Headers, Body, Status, Response, Names>
  > = ResponseOf<
    RouteOf<Method, Path, Params, Query, Headers, Body, Status, Response, Names>
  >,
>(
  config: {
    method: Method;
    path: Path;
    params?: Params;
    query?: Query;
    headers?: Headers;
    body?: Body;
    status?: Status;
    response?: Response;
    description: string;
    errors?: Declaration<Names, Return, KilnNameOf<Body>>;
    handler: (
      c: ContextOf<
        RouteOf<
          Method,
          Path,
          Params,
          Query,
          Headers,
          Body,
          Status,
          Response,
          Names
        >
      >,
      errors: Errors<Names>,
    ) => Return;
  } & PolicyField<Policy> &
    (Status extends ContentlessStatusCode
      ? {
          response?: never;
        }
      : {}),
) => {
  const {
    method,
    path,
    params,
    query,
    headers,
    body,
    status = 200,
    response,
    description,
    errors: declared = {},
    policy,
    handler,
  } = config;
  // Only the schemas given: zod-openapi validates and documents each one there
  const request = Object.fromEntries(
    Object.entries({
      params,
      query,
      headers,
      body: body && toBody(body),
    }).filter(([, schema]) => schema !== undefined),
  );
  const route = {
    method,
    path,
    request,
    responses: {
      [status]: response
        ? json(response, description)
        : {
            description,
          },
      ...toResponses(declared),
      ...(Object.keys(request).length > 0 ? invalidRequest : {}),
      ...(body ? bodyErrors : {}),
      ...serverError,
    },
  };

  // What zod-openapi runs: the handler, given the route's errors for the request
  const registered: Route<
    RouteOf<Method, Path, Params, Query, Headers, Body, Status, Response, Names>
  >['handler'] = (c) => handler(c, toErrors(c, declared));

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the route built from config, typed by config's own type parameters, which TypeScript can't follow through the object built
  return {
    route,
    handler: registered,
    ...(policy === undefined
      ? {}
      : {
          policy,
        }),
  } as Route<
    RouteOf<Method, Path, Params, Query, Headers, Body, Status, Response, Names>
  >;
};

// A router, for its type alone: what openapiRoutes returns on one
declare const router: OpenAPIHono<AppEnv>;

// A record's router, as openapiRoutes types it. zod-openapi gives no routes to
// the client for an array of unknown length, so the routes are a tuple of one:
// their union, which its merge spreads over every route. Named, since the type
// it infers can't be written in the package's declarations
type RecordRouter<Routes extends Record<string, AnyRoute>> = ReturnType<
  typeof router.openapiRoutes<[Routes[keyof Routes]]>
>;

// A route as a record registers it: under its key, and with a policy, enforced
// before its validators, declaring enforce's errors beside its own, which win,
// and saying the route's policy in the document
const toRegistered = (
  operationId: string,
  { route, policy }: AnyRoute,
  enforced?: AnyPolicy,
): RouteConfig =>
  enforced && policy !== undefined
    ? {
        ...route,
        operationId,
        'x-policy': policy,
        middleware: toPolicyMiddleware(enforced, policy),
        responses: {
          ...toResponses(enforced.errors ?? {}),
          ...route.responses,
        },
      }
    : {
        ...route,
        operationId,
      };

// A record of routes as a router, each registered in the record's order with
// its key as its operationId
const toRouter = <Routes extends Record<string, AnyRoute>>(
  routes: Routes,
  enforced?: AnyPolicy,
): RecordRouter<Routes> =>
  createRouter().openapiRoutes(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an array at runtime, typed as one element, the union of every route, which zod-openapi's merge spreads over each route
    Object.entries(routes).map(([operationId, entry]) => ({
      route: toRegistered(operationId, entry, enforced),
      handler: entry.handler,
    })) as [Routes[keyof Routes]],
  );

export { defineRoute, toRouter };
export type { AnyRoute, PolicyField, Route };
