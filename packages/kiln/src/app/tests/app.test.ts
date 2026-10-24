import { createRoute, z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { hc } from 'hono/client';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { NotFound } from '#/http/http.errors.ts';
import { createMiddleware, defineMiddleware } from '#/http/http.middleware.ts';
import { defineRoute } from '#/http/http.route.ts';
import { createRouter } from '#/http/http.router.ts';
import { json } from '#/http/http.schemas.ts';

import type { AppEnv } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { InferResponseType } from 'hono/client';

// What createApp wires up, checked once with routes of its own rather than
// through every domain's: Hono calls the hooks, but registering them is ours
const app = createApp().openapi(
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
);

// An API whose requests carry a variable of its own, set by its middleware.
// The variables are the ones http.types.test.ts registers for every test
const greetingRouter = createRouter().openapi(
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
  (c) =>
    c.json(
      {
        greeting: c.var.greeting,
      },
      200,
    ),
);

const greet = createMiddleware(async (c, next) => {
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

const greetingApp = createApp({
  middleware: [greet],
}).route('/', greetingRouter);

const request = async (
  path: string,
  to: typeof app | typeof greetingApp = app,
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

it('runs its middleware before the routes added after it', async () => {
  expect(
    await request('/greeting', greetingApp, {
      greeting: 'Hello',
    }),
  ).toEqual({
    status: 200,
    body: {
      greeting: 'Hello',
    },
  });
  expect(await request('/greeting', greetingApp)).toEqual({
    status: 401,
    body: {
      message: 'No greeting',
    },
  });
});

it('keeps the OpenAPI methods on its type, with middleware given or chained', () => {
  expectTypeOf(
    createApp({
      middleware: [greet],
    }),
  ).toExtend<OpenAPIHono<AppEnv>>();
  expectTypeOf(createApp().use(greet)).toExtend<OpenAPIHono<AppEnv>>();
  expectTypeOf(createApp().use('/greeting', greet)).toExtend<
    OpenAPIHono<AppEnv>
  >();
});

// An API wired by createApp alone, with no type arguments: a middleware that
// says who's asking, and routers at two paths, one of them the root
const itemsRouter = createRouter().openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: json(
        z.object({
          id: z.string(),
          user: z.string(),
        }),
        'One item',
      ),
    },
  }),
  (c) =>
    c.json(
      {
        id: c.req.valid('param').id,
        user: c.var.user,
      },
      200,
    ),
);

const whoamiRouter = createRouter().openapi(
  createRoute({
    method: 'get',
    path: '/whoami',
    responses: {
      200: json(
        z.object({
          user: z.string(),
        }),
        "Who's asking",
      ),
    },
  }),
  (c) =>
    c.json(
      {
        user: c.var.user,
      },
      200,
    ),
);

const routedApp = createApp({
  middleware: [
    async (c, next) => {
      c.set('user', c.req.header('user') ?? 'Nobody');

      return next();
    },
  ],
  routes: {
    '/items': itemsRouter,
    '/': whoamiRouter,
  },
});

const client = hc<typeof routedApp>('http://localhost', {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
    routedApp.request(input, init, env),
  headers: {
    user: 'Ada',
  },
});

it('registers each router at its path, after the middleware', async () => {
  const item = await client.items[':id'].$get({
    param: {
      id: 'a',
    },
  });
  const whoami = await client.whoami.$get();

  expect([await item.json(), await whoami.json()]).toEqual([
    {
      id: 'a',
      user: 'Ada',
    },
    {
      user: 'Ada',
    },
  ]);
});

it('gives a typed client every route it registers, and no other', () => {
  expectTypeOf<
    InferResponseType<(typeof client.items)[':id']['$get'], 200>
  >().toEqualTypeOf<{
    id: string;
    user: string;
  }>();
  expectTypeOf<
    InferResponseType<typeof client.whoami.$get, 200>
  >().toEqualTypeOf<{
    user: string;
  }>();

  // @ts-expect-error: no router is at /other
  void client.other;
});

// Each GET operation in an app's document, by path: its statuses and what
// each one means
const documented = (from: OpenAPIHono<AppEnv>) => {
  const { paths = {} } = from.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Items',
      version: '1.0.0',
    },
  });

  return Object.fromEntries(
    Object.entries(paths).map(([path, item]) => [
      path,
      Object.fromEntries(
        Object.entries(item.get?.responses ?? {}).map(
          ([status, response]: [
            string,
            {
              description?: string;
            },
          ]) => [status, response.description],
        ),
      ),
    ]),
  );
};

describe("a middleware's errors", () => {
  // An auth guard: it answers a 401 or a 403, or lets the request through
  const guard = defineMiddleware(
    async (c, next) => {
      const token = c.req.header('authorization');

      if (!token) {
        return c.json(
          {
            message: 'No token',
          },
          401,
        );
      }

      if (token !== 'Bearer good') {
        return c.json(
          {
            message: 'Bad token',
          },
          403,
        );
      }

      return next();
    },
    {
      errors: {
        401: 'No token was sent',
        403: 'The token was refused',
      },
    },
  );

  const listItems = defineRoute({
    method: 'get',
    path: '/',
    response: z.array(z.string()),
    description: 'All items',
    handler: (c) => c.json([], 200),
  });

  const getSecret = defineRoute({
    method: 'get',
    path: '/',
    response: z.string(),
    description: 'The secret',
    errors: {
      403: 'Only an admin may read it',
    },
    handler: (c) => c.json('secret', 200),
  });

  const itemsRoutes = {
    listItems,
  };

  const pingRouter = createRouter().openapi(
    createRoute({
      method: 'get',
      path: '/ping',
      responses: {
        200: json(z.string(), 'Pong'),
      },
    }),
    (c) => c.json('pong', 200),
  );

  const guarded = createApp({
    middleware: [async (_, next) => next(), guard],
    routes: {
      '/items': itemsRoutes,
      '/secret': {
        getSecret,
      },
      '/': pingRouter,
    },
  });

  // The status the guarded app answers /items with, given a token or none
  const statusFor = async (authorization?: string) => {
    const response = await guarded.request(
      '/items',
      {
        headers: authorization
          ? {
              authorization,
            }
          : {},
      },
      env,
    );

    return response.status;
  };

  it('adds them to every route, records and routers alike', () => {
    expect(documented(guarded)).toEqual({
      '/items': {
        200: 'All items',
        401: 'No token was sent',
        403: 'The token was refused',
        500: 'Something failed on the server',
      },
      '/secret': {
        200: 'The secret',
        401: 'No token was sent',
        403: 'Only an admin may read it',
        500: 'Something failed on the server',
      },
      '/ping': {
        200: 'Pong',
        401: 'No token was sent',
        403: 'The token was refused',
      },
    });
  });

  it("keeps a route's own description for a status it declares too", () => {
    expect(documented(guarded)['/secret']?.[403]).toBe(
      'Only an admin may read it',
    );
  });

  it('adds nothing for a plain middleware', () => {
    const plain = createApp({
      middleware: [async (_, next) => next()],
      routes: {
        '/items': itemsRoutes,
      },
    });

    expect(documented(plain)['/items']).toEqual({
      200: 'All items',
      500: 'Something failed on the server',
    });
  });

  it('leaves the routes themselves as they were, for any other app', () => {
    const unguarded = createApp({
      routes: {
        '/items': itemsRoutes,
      },
    });

    expect(documented(unguarded)['/items']).toEqual({
      200: 'All items',
      500: 'Something failed on the server',
    });
  });

  it('runs its handler before every route', async () => {
    expect(
      await Promise.all([
        statusFor(),
        statusFor('Bearer bad'),
        statusFor('Bearer good'),
      ]),
    ).toEqual([401, 403, 200]);
  });

  it("refuses the 500, which is onError's", () => {
    defineMiddleware(async (_, next) => next(), {
      errors: {
        // @ts-expect-error: onError's 500 is Kiln's
        500: 'Something failed',
      },
    });
  });
});
