import { createRoute, z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { expect, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { createMiddleware } from '#/http/http.middleware.ts';
import { createRouter } from '#/http/http.router.ts';
import { json } from '#/http/http.schemas.ts';
import { database } from '#/model/model.database.ts';

// An API with the database and a middleware that sets a variable of its own,
// both read by one route, as http.types.test.ts registers them. database()
// takes the variables from createApp, and would break the app's type if it
// said only { db }
const signedIn = createMiddleware(async (c, next) => {
  c.set('user', c.req.header('user') ?? 'Nobody');

  return next();
});

const answerRouter = createRouter().openapi(
  createRoute({
    method: 'get',
    path: '/answer',
    responses: {
      200: json(
        z.object({
          answer: z.number(),
          user: z.string(),
        }),
        'What the database answered, and who asked',
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
        user: c.var.user,
      },
      200,
    );
  },
);

const app = createApp({
  middleware: [database((bindings) => bindings.DB), signedIn],
  routes: {
    '/': answerRouter,
  },
});

it('gives every handler the D1 database its binding names', async () => {
  const response = await app.request(
    '/answer',
    {
      headers: {
        user: 'Ada',
      },
    },
    env,
  );

  expect(await response.json()).toEqual({
    answer: 42,
    user: 'Ada',
  });
});
