import { createRoute, z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { expect, it } from 'vite-plus/test';

import { NotFound } from '#/http/http.errors.ts';
import { json } from '#/http/http.schemas.ts';

import { createApp } from './app.ts';

// What createApp wires up, checked once with routes of its own rather than
// through every domain's: Hono calls the hooks, but registering them is ours
const app = createApp()
  .openapi(
    createRoute({
      method: 'get',
      path: '/items/{id}',
      request: {
        params: z.object({
          id: z.uuid('Id must be a uuid'),
        }),
      },
      responses: {
        200: json(z.object({}), 'Never sent'),
      },
    }),
    () => {
      throw new NotFound('Item not found');
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/db',
      responses: {
        200: json(
          z.object({
            answer: z.number(),
          }),
          'What the database answered',
        ),
      },
    }),
    async (c) => {
      const row = await c.var.db.get<{
        answer: number;
      }>(sql`select 42 as answer`);

      return c.json(
        {
          answer: row.answer,
        },
        200,
      );
    },
  );

const request = async (path: string) => {
  const response = await app.request(path, {}, env);

  return {
    status: response.status,
    body: await response.json(),
  };
};

it('answers a request its schema refuses with a 422 and its issues', async () => {
  expect(await request('/items/not-a-uuid')).toEqual({
    status: 422,
    body: {
      message: 'Invalid Request',
      issues: [
        {
          in: 'path',
          path: 'id',
          message: 'Id must be a uuid',
        },
      ],
    },
  });
});

it('makes a thrown NotFound a 404 with its message', async () => {
  expect(await request(`/items/${crypto.randomUUID()}`)).toEqual({
    status: 404,
    body: {
      message: 'Item not found',
    },
  });
});

it('answers a path no route has with a 404', async () => {
  expect(await request('/nothing')).toEqual({
    status: 404,
    body: {
      message: 'Not Found',
    },
  });
});

it('gives every handler the database', async () => {
  expect(await request('/db')).toEqual({
    status: 200,
    body: {
      answer: 42,
    },
  });
});
