import { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from './http.types.ts';
import type { OpenAPIHonoOptions, z } from '@hono/zod-openapi';

// Where an input was, in OpenAPI's words, as the document names it
const IN = {
  json: 'body',
  form: 'body',
  query: 'query',
  param: 'path',
  header: 'header',
  cookie: 'cookie',
} as const;

type Issue = {
  in: (typeof IN)[keyof typeof IN];
  path: string;
  message: string;
};

// What a failed validation tells the client: each problem, where it was and
// what's wrong, without zod's internals. An unknown key is an issue of its own,
// at its own path, as a client looks for it
const toIssues = (target: keyof typeof IN, error: z.ZodError): Issue[] =>
  error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        in: IN[target],
        path: [...issue.path, key].map(String).join('.'),
        message: 'Unrecognized key',
      }));
    }

    return [
      {
        in: IN[target],
        path: issue.path.map(String).join('.'),
        message: issue.message,
      },
    ];
  });

const defaultHook: OpenAPIHonoOptions<AppEnv>['defaultHook'] = (
  result,
  ctx,
) => {
  if (result.success) return undefined;

  return ctx.json(
    {
      message: 'Invalid Request',
      issues: toIssues(result.target, result.error),
    },
    422,
  );
};

const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    strict: false,
    defaultHook,
  });

export { createRouter, toIssues };
