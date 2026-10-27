import { OpenAPIHono } from '@hono/zod-openapi';

import { LOCATIONS } from './http.schemas.ts';

import type { AppEnv, InvalidRequest, Issue } from './http.types.ts';
import type { z } from '@hono/zod-openapi';

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

// The app every route is registered on: a request its schemas refuse is a
// 422 with the issues
const createRouter = () =>
  new OpenAPIHono<AppEnv>({
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

export { createRouter, toIssues };
