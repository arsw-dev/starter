import { z } from '@hono/zod-openapi';

// Where an input was, in OpenAPI's words, as the document names it
const LOCATIONS = {
  json: 'body',
  form: 'body',
  query: 'query',
  param: 'path',
  header: 'header',
  cookie: 'cookie',
} as const;

const errorSchema = z
  .object({
    message: z.string(),
  })
  .openapi('Error');

const issueSchema = z.object({
  in: z.enum(LOCATIONS),
  path: z.string(),
  message: z.string(),
});

const invalidSchema = errorSchema
  .extend({
    issues: z.array(issueSchema),
  })
  .openapi('InvalidRequest');

// A JSON response as a route declares it: its schema, which types the
// handler's c.json() and describes the body in the document, and what it means
const json = <TSchema extends z.ZodType>(
  schema: TSchema,
  description: string,
) => ({
  content: {
    'application/json': {
      schema,
    },
  },
  description,
});

// What every route can answer besides its own responses: anything unexpected,
// which onError makes a 500 that says nothing about it
const serverError = {
  500: json(errorSchema, 'Something failed on the server'),
};

// And a route that takes a body: one that isn't JSON, which Hono's validator
// answers with a 400 before the route's schema sees it
const malformedBody = {
  400: json(errorSchema, 'The body is not valid JSON'),
};

export {
  LOCATIONS,
  errorSchema,
  invalidSchema,
  issueSchema,
  json,
  malformedBody,
  serverError,
};
