import { z } from '@hono/zod-openapi';

import { createRouter } from './http.router.ts';
import {
  errors,
  invalidRequest,
  json,
  malformedBody,
  serverError,
  unsupportedBody,
} from './http.schemas.ts';

import type { Router } from './http.router.ts';
import type { ErrorDeclaration, invalidSchema } from './http.schemas.ts';
import type { AppEnv, ErrorDescriptions } from './http.types.ts';
import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
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
  Errors,
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
    [Code in keyof Errors]: ErrorDeclaration;
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

// The statuses Kiln declares on a route, which the route itself can't
type KilnStatus<Body> =
  | 422
  | 500
  | (Body extends BodyInput ? 400 | 415 : never);

// A route as zod-openapi registers it, and its handler
type Route<Config extends RouteConfig = RouteConfig> = {
  route: Config;
  handler: RouteHandler<Config, AppEnv>;
};

// Any route, whatever its handler: a handler is typed by its own route, so
// none fits another's
type AnyRoute = {
  route: RouteConfig;
  handler: unknown;
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
  Errors,
> = {
  method: Method;
  path: Path;
  request: RequestOf<Params, Query, Headers, Body>;
  responses: ResponsesOf<
    Status,
    Response,
    Errors,
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

// What a route with a body can answer before its handler runs
const bodyErrors = {
  ...malformedBody,
  ...unsupportedBody,
};

// A route, as one object: its contract and its handler, typed from the rest.
// Kiln adds the responses it causes itself, and a route can't declare those
const defineRoute = <
  const Method extends RouteConfig['method'],
  const Path extends string,
  Params extends z.ZodType | undefined = undefined,
  Query extends z.ZodType | undefined = undefined,
  Headers extends z.ZodType | undefined = undefined,
  Body extends BodyInput | undefined = undefined,
  Status extends SuccessStatusCode = 200,
  Response extends z.ZodType | undefined = undefined,
  const Errors extends ErrorDescriptions = {},
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
    errors?: Errors & {
      [Code in KilnStatus<Body>]?: never;
    };
    handler: RouteHandler<
      RouteOf<
        Method,
        Path,
        Params,
        Query,
        Headers,
        Body,
        Status,
        Response,
        Errors
      >,
      AppEnv
    >;
  } & (Status extends ContentlessStatusCode
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
      ...errors(declared),
      ...(Object.keys(request).length > 0 ? invalidRequest : {}),
      ...(body ? bodyErrors : {}),
      ...serverError,
    },
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the route built from config, typed by config's own type parameters, which TypeScript can't follow through the object built
  return {
    route,
    handler,
  } as Route<
    RouteOf<
      Method,
      Path,
      Params,
      Query,
      Headers,
      Body,
      Status,
      Response,
      Errors
    >
  >;
};

// A router, for its type alone: what openapiRoutes returns on one
declare const router: Router<AppEnv>;

// A record's router, as openapiRoutes types it. zod-openapi gives no routes to
// the client for an array of unknown length, so the routes are a tuple of one:
// their union, which its merge spreads over every route. Named, since the type
// it infers can't be written in the package's declarations
type RecordRouter<Routes extends Record<string, AnyRoute>> = ReturnType<
  typeof router.openapiRoutes<[Routes[keyof Routes]]>
>;

// A record of routes as a router, each registered in the record's order with
// its key as its operationId
const toRouter = <Routes extends Record<string, AnyRoute>>(
  routes: Routes,
): RecordRouter<Routes> =>
  createRouter().openapiRoutes(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an array at runtime, typed as one element, the union of every route, which zod-openapi's merge spreads over each route
    Object.entries(routes).map(([operationId, { route, handler }]) => ({
      route: {
        ...route,
        operationId,
      },
      handler,
    })) as [Routes[keyof Routes]],
  );

export { defineRoute, toRouter };
export type { AnyRoute, Route };
