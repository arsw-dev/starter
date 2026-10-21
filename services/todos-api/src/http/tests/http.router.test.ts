import { z } from '@hono/zod-openapi';
import { expect, it } from 'vite-plus/test';

import { toIssues } from '#/http/http.router.ts';

// The zod error a schema gives for the input it's handed
const errorFor = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);

  if (result.success) throw new Error('Expected the input to fail');

  return result.error;
};

const title = z.object({
  title: z.string().min(1),
});

it.each([
  ['json', 'body'],
  ['form', 'body'],
  ['query', 'query'],
  ['param', 'path'],
  ['header', 'header'],
  ['cookie', 'cookie'],
] as const)('names a %s failure %s, as the document does', (target, name) => {
  const [issue] = toIssues(
    target,
    errorFor(title, {
      title: '',
    }),
  );

  expect(issue?.in).toBe(name);
});

it("keeps the path and zod's message, and nothing else of zod's", () => {
  const error = errorFor(title, {
    title: '',
  });

  expect(toIssues('json', error)).toEqual([
    {
      in: 'body',
      path: 'title',
      message: error.issues[0]?.message,
    },
  ]);
});

it('joins a nested path with dots', () => {
  const tags = z.object({
    tags: z.array(z.string().min(1)),
  });
  const error = errorFor(tags, {
    tags: ['a', ''],
  });

  expect(toIssues('json', error).map((issue) => issue.path)).toEqual([
    'tags.1',
  ]);
});

it('gives a problem with the whole input an empty path', () => {
  const error = errorFor(title, 'not an object');

  expect(toIssues('json', error).map((issue) => issue.path)).toEqual(['']);
});

it('reports every problem, in order', () => {
  const two = z.object({
    title: z.string().min(1),
    done: z.boolean(),
  });
  const error = errorFor(two, {
    title: '',
    done: 'yes',
  });

  expect(toIssues('json', error).map((issue) => issue.path)).toEqual([
    'title',
    'done',
  ]);
});

it('gives each unknown key an issue of its own, at its path', () => {
  const error = errorFor(z.strictObject(title.shape), {
    title: 'Buy milk',
    done: true,
    pk: 5,
  });

  expect(toIssues('json', error)).toEqual([
    {
      in: 'body',
      path: 'done',
      message: 'Unrecognized key',
    },
    {
      in: 'body',
      path: 'pk',
      message: 'Unrecognized key',
    },
  ]);
});

it('puts an unknown nested key under its parent', () => {
  const nested = z.object({
    meta: z.strictObject({}),
  });
  const error = errorFor(nested, {
    meta: {
      extra: 1,
    },
  });

  expect(toIssues('json', error).map((issue) => issue.path)).toEqual([
    'meta.extra',
  ]);
});
