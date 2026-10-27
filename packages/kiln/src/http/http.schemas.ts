import { z } from '@hono/zod-openapi';

import { statusByName } from './http.errors.ts';

import type { ErrorDescriptions, ErrorStatus } from './http.errors.ts';

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
// handler's responses and describes the body in the document, and what it
// means
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

type ErrorDeclaration = ReturnType<typeof json<typeof errorSchema>>;

// Errors declared by name, as the document's responses: an error body under
// each one's status, with what it means
const toResponses = (descriptions: ErrorDescriptions) =>
  Object.fromEntries(
    Object.entries(descriptions).flatMap(([name, description]) => {
      const status = statusByName.get(name);

      return status === undefined || description === undefined
        ? []
        : [[status, json(errorSchema, description)]];
    }),
  ) as Partial<Record<ErrorStatus, ErrorDeclaration>>;

// What a route with any request schema can answer: one its schemas refuse,
// which the router's validation hook makes a 422 with the issues
const invalidRequest = {
  422: json(invalidSchema, 'The request does not match its schema'),
};

// What every route can answer besides its own responses: anything unexpected,
// which onError makes a 500 that says nothing about it
const serverError = {
  500: json(errorSchema, 'Something failed on the server'),
};

// And a route that takes a body: one that isn't JSON, which Hono's validator
// answers with a 400 before the route's schema sees it, and one sent as
// something other than JSON, which zod-openapi answers with a 415
const bodyErrors = {
  400: json(errorSchema, 'The body is not valid JSON'),
  415: json(errorSchema, 'The body is not sent as JSON'),
};

export {
  LOCATIONS,
  bodyErrors,
  errorSchema,
  invalidRequest,
  invalidSchema,
  issueSchema,
  json,
  serverError,
  toResponses,
};
export type { ErrorDeclaration };
