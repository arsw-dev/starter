import { createRoute, z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { expect, expectTypeOf, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { NotFound } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';
import { json } from '#/http/http.schemas.ts';

import type { AppEnv } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';

// What createApp wires up, checked once with routes of its own rather than
// through every domain's: Hono calls the hooks, but registering them is ours
const app = createApp({
  db: (bindings) => bindings.DB,
})
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

// An API with no database, whose requests carry a variable of its own, set
// by its middleware
type Variables = {
  greeting: string;
};

const greetingRouter = createRouter<Variables>().openapi(
  createRoute({
    method: 'get',
    path: '/greeting',
    responses: {
      200: json(
        z.object({
          greeting: z.string(),
        }),
        'What the middleware set',
      ),
    },
  }),
  (c) => {
    // @ts-expect-error: an API that declares its variables without db has none
    void c.var.db;

    return c.json(
      {
        greeting: c.var.greeting,
      },
      200,
    );
  },
);

const greet = createMiddleware<AppEnv<Variables>>(async (c, next) => {
  const greeting = c.req.header('greeting');

  if (!greeting) {
    return c.json(
      {
        message: 'No greeting',
      },
      401,
    );
  }

  c.set('greeting', greeting);

  return next();
});

const appWithoutDb = createApp<Variables>({
  middleware: [greet],
}).route('/', greetingRouter);

const request = async (
  path: string,
  to: typeof app | typeof appWithoutDb = app,
  headers: Record<string, string> = {},
) => {
  const response = await to.request(
    path,
    {
      headers,
    },
    env,
  );

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

it('runs without a database, and runs its middleware before the routes added after it', async () => {
  expect(
    await request('/greeting', appWithoutDb, {
      greeting: 'Hello',
    }),
  ).toEqual({
    status: 200,
    body: {
      greeting: 'Hello',
    },
  });
  expect(await request('/greeting', appWithoutDb)).toEqual({
    status: 401,
    body: {
      message: 'No greeting',
    },
  });
});

it('keeps the OpenAPI methods on its type, with middleware given or chained', () => {
  expectTypeOf(
    createApp<Variables>({
      middleware: [greet],
    }),
  ).toExtend<OpenAPIHono<AppEnv<Variables>>>();
  expectTypeOf(createApp<Variables>().use(greet)).toExtend<
    OpenAPIHono<AppEnv<Variables>>
  >();
  expectTypeOf(createApp<Variables>().use('/greeting', greet)).toExtend<
    OpenAPIHono<AppEnv<Variables>>
  >();
});
