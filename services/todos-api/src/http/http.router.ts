import { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from './http.types.ts';
import type { OpenAPIHonoOptions } from '@hono/zod-openapi';

// Where an input was, in OpenAPI's words, as the document names it
const IN = {
  json: 'body',
  form: 'body',
  query: 'query',
  param: 'path',
  header: 'header',
  cookie: 'cookie',
} as const;

const defaultHook: OpenAPIHonoOptions<AppEnv>['defaultHook'] = (
  result,
  ctx,
) => {
  if (result.success) return undefined;

  const issues = result.error.issues.map((issue) => ({
    in: IN[result.target],
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));

  return ctx.json(
    {
      message: 'Invalid Request',
      issues,
    },
    422,
  );
};

const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    strict: false,
    defaultHook,
  });

export { createRouter };
