import { OpenAPIHono } from '@hono/zod-openapi';

import { LOCATIONS } from './http.schemas.ts';

import type { AppEnv, InvalidRequest, Issue } from './http.types.ts';
import type { z } from '@hono/zod-openapi';
import type { Env, MiddlewareHandler, Schema } from 'hono';
import type { IntersectNonAnyTypes, MergePath } from 'hono/types';

// What a failed validation tells the client: each problem, where it was and
// what's wrong, without zod's internals. An unknown key is an issue of its own,
// at its own path, as a client looks for it
const toIssues = (target: keyof typeof LOCATIONS, error: z.ZodError): Issue[] =>
  error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        in: LOCATIONS[target],
        path: [...issue.path, key].map(String).join('.'),
        message: 'Unrecognized key',
      }));
    }

    return [
      {
        in: LOCATIONS[target],
        path: issue.path.map(String).join('.'),
        message: issue.message,
      },
    ];
  });

// OpenAPIHono keeps Hono's use, whose type returns a plain Hono, so a chain
// such as createApp().use(guard) loses openapi and can't be passed on as an
// OpenAPIHono. The router returns itself at runtime; these signatures, tried
// before Hono's, say so
type Use<E extends Env, S extends Schema, BasePath extends string> = {
  <E2 extends Env = E>(
    ...handlers: MiddlewareHandler<E2, MergePath<BasePath, '*'>>[]
  ): Router<IntersectNonAnyTypes<[E, E2]>, S, BasePath>;
  <P extends string, E2 extends Env = E>(
    path: P,
    ...handlers: MiddlewareHandler<E2, MergePath<BasePath, P>>[]
  ): Router<IntersectNonAnyTypes<[E, E2]>, S, BasePath>;
};

class Router<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
> extends OpenAPIHono<E, S, BasePath> {
  declare use: Use<E, S, BasePath> & OpenAPIHono<E, S, BasePath>['use'];
}

const createRouter = <Variables extends object = {}>() =>
  new Router<AppEnv<Variables>>({
    strict: false,
    defaultHook: (result, ctx) => {
      if (result.success) return undefined;

      return ctx.json(
        {
          message: 'Invalid Request',
          issues: toIssues(result.target, result.error),
        } satisfies InvalidRequest,
        422,
      );
    },
  });

export { Router, createRouter, toIssues };
