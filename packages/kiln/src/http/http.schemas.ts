import { z } from '@hono/zod-openapi';

import type {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
} from 'hono/utils/http-status';

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

// The statuses an error body answers; a 422 has its issues too, so a route
// declares it with json(invalidSchema, …)
type ErrorStatus = Exclude<ClientErrorStatusCode | ServerErrorStatusCode, 422>;

type ErrorDeclaration = ReturnType<typeof json<typeof errorSchema>>;

// A route's errors, by status: what each one means, as an error body. Each
// status stays a key of its own, so the handler's c.json(body, 404) is typed
// against it
const errors = <
  const Descriptions extends Partial<Record<ErrorStatus, string>>,
>(
  descriptions: Descriptions,
) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fromEntries can't carry the keys: each is a status from descriptions, as an error body
  Object.fromEntries(
    Object.entries(descriptions).map(([status, description]) => [
      status,
      json(errorSchema, description),
    ]),
  ) as {
    [Status in keyof Descriptions]: ErrorDeclaration;
  };

// What every route can answer besides its own responses: anything unexpected,
// which onError makes a 500 that says nothing about it
const serverError = errors({
  500: 'Something failed on the server',
});

// And a route that takes a body: one that isn't JSON, which Hono's validator
// answers with a 400 before the route's schema sees it
const malformedBody = errors({
  400: 'The body is not valid JSON',
});

export {
  LOCATIONS,
  errorSchema,
  errors,
  invalidSchema,
  issueSchema,
  json,
  malformedBody,
  serverError,
};
