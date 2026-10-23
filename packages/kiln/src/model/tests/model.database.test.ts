import { createRoute, z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { expect, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { createRouter } from '#/http/http.router.ts';
import { json } from '#/http/http.schemas.ts';
import { database } from '#/model/model.database.ts';

import type { AppEnv } from '#/http/http.types.ts';
import type { DB } from '#/model/model.database.ts';

// An API with the database and a middleware that sets a variable of its own,
// both read by one route. Its Variables is written once, for the router and
// the guard: database() takes it from createApp, and would break the app's
// type if it said only { db }
type Variables = {
  db: DB;
  user: string;
};

const signedIn = createMiddleware<AppEnv<Variables>>(async (c, next) => {
  c.set('user', c.req.header('user') ?? 'Nobody');

  return next();
});

const answerRouter = createRouter<Variables>().openapi(
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
