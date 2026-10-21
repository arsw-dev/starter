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

export { LOCATIONS, errorSchema, issueSchema, invalidSchema, json };
