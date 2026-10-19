import { createRoute, z } from '@hono/zod-openapi';
import { expect, it } from 'vite-plus/test';

import { createRouter } from './http.router.ts';

// One route with every part a request can fail: its path, its query and its
// body
const route = createRoute({
  method: 'post',
  path: '/things/{id}',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
    query: z.object({
      limit: z.coerce.number().int().positive().optional(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().min(1),
            tags: z.array(z.string().min(1)).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Accepted',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
          }),
        },
      },
    },
  },
});

const router = createRouter().openapi(route, (ctx) =>
  ctx.json(
    {
      ok: true,
    },
    200,
  ),
);

const post = (path: string, body: unknown) =>
  router.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

it('lets a valid request through to its handler', async () => {
  const response = await post('/things/1?limit=5', {
    title: 'A thing',
  });

  expect(response.status).toBe(200);
});

it('answers an invalid body with a 422, each issue by where it is', async () => {
  const response = await post('/things/1', {
    title: '',
  });

  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    message: 'Invalid Request',
    issues: [
      {
        in: 'body',
        path: 'title',
        message: expect.any(String),
      },
    ],
  });
});

it('joins a nested path with dots', async () => {
  const response = await post('/things/1', {
    title: 'A thing',
    tags: [''],
  });

  expect(await response.json()).toMatchObject({
    issues: [
      {
        in: 'body',
        path: 'tags.0',
      },
    ],
  });
});

it('names the query and the path the way the document does', async () => {
  const query = await post('/things/1?limit=-1', {
    title: 'A thing',
  });
  const path = await post('/things/abc', {
    title: 'A thing',
  });

  expect(await query.json()).toMatchObject({
    issues: [
      {
        in: 'query',
        path: 'limit',
      },
    ],
  });
  expect(await path.json()).toMatchObject({
    issues: [
      {
        in: 'path',
        path: 'id',
      },
    ],
  });
});

// Each part is checked in turn, and the first to fail answers
it('reports only the first part that fails', async () => {
  const response = await post('/things/1?limit=-1', {
    title: '',
  });
  const { issues } = await response.json<{
    issues: {
      in: string;
    }[];
  }>();

  expect(issues.map((issue) => issue.in)).toEqual(['query']);
});

it('treats a trailing slash as the same path', async () => {
  const response = await createRouter()
    .get('/things', (ctx) => ctx.text('ok'))
    .request('/things/');

  expect(response.status).toBe(200);
});
