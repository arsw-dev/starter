import { createRoute, z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { hc } from 'hono/client';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { defineAuthorize } from '#/http/http.authorize.ts';
import { Forbidden, NotFound, Unauthorized } from '#/http/http.errors.ts';
import { createMiddleware, defineMiddleware } from '#/http/http.middleware.ts';
import { defineRoute } from '#/http/http.route.ts';
import { createRouter } from '#/http/http.router.ts';
import { json } from '#/http/http.schemas.ts';

import type { Access, AppEnv } from '#/http/http.types.ts';
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

const documentOf = (from: OpenAPIHono<AppEnv>) =>
  from.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Items',
      version: '1.0.0',
    },
  });

// Each GET operation in an app's document, by path: its statuses and what
// each one means
const documented = (from: OpenAPIHono<AppEnv>) => {
  const { paths = {} } = documentOf(from);

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

// The status an app answers a request with, as a caller
const statusFor = async (
  to: OpenAPIHono<AppEnv>,
  user: string,
  method: string,
  path: string,
  body?: unknown,
) => {
  const response = await to.request(
    path,
    {
      method,
      headers: {
        user,
        'content-type': 'application/json',
      },
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
          }),
    },
    env,
  );

  return response.status;
};

describe('authorize', () => {
  const readItems = defineRoute({
    method: 'get',
    path: '/',
    response: z.array(z.string()),
    description: 'All items',
    access: 'read',
    handler: (c) => c.json([], 200),
  });

  const createItem = defineRoute({
    method: 'post',
    path: '/',
    body: z.strictObject({
      title: z.string(),
    }),
    status: 201,
    response: z.string(),
    description: 'Item created',
    access: 'write',
    handler: (c) => c.json(c.req.valid('json').title, 201),
  });

  const getStats = defineRoute({
    method: 'get',
    path: '/',
    response: z.number(),
    description: 'How many items there are',
    errors: {
      403: 'Only an admin may read them',
    },
    handler: (c) => c.json(0, 200),
  });

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

  // A reader may read, a writer may write too, and only an admin may call a
  // route that says nothing. Who's calling is the middleware's to say
  const byCaller = defineAuthorize(
    (c, access) => {
      const { user } = c.var;

      if (user === 'Nobody') throw new Unauthorized('Who are you?');
      if (user === 'admin') return;
      if (access === undefined) throw new Forbidden('Admins only');

      if (access === 'write' && user !== 'writer') {
        throw new Forbidden('Read only');
      }
    },
    {
      errors: {
        401: 'Nobody signed in',
        403: 'The caller may not call this route',
      },
    },
  );

  const routes = {
    '/items': {
      readItems,
      createItem,
    },
    '/stats': {
      getStats,
    },
    '/': pingRouter,
  };

  const authorized = createApp({
    middleware: [
      async (c, next) => {
        c.set('user', c.req.header('user') ?? 'Nobody');

        return next();
      },
    ],
    authorize: byCaller,
    routes,
  });

  it("runs the check with each route's access, which it allows or refuses", async () => {
    expect(
      await Promise.all([
        statusFor(authorized, 'reader', 'GET', '/items'),
        statusFor(authorized, 'reader', 'POST', '/items', {
          title: 'Milk',
        }),
        statusFor(authorized, 'writer', 'POST', '/items', {
          title: 'Milk',
        }),
      ]),
    ).toEqual([200, 403, 201]);
  });

  it('gives the check undefined for a route without access', async () => {
    const seen: (Access | undefined)[] = [];
    const recording = createApp({
      authorize: defineAuthorize(
        (_, access) => {
          seen.push(access);
        },
        {
          errors: {},
        },
      ),
      routes: {
        '/items': {
          readItems,
        },
        '/stats': {
          getStats,
        },
      },
    });

    await recording.request('/items', {}, env);
    await recording.request('/stats', {}, env);

    expect(seen).toEqual(['read', undefined]);
  });

  it('refuses a caller before the route validates the request', async () => {
    expect(
      await statusFor(authorized, 'reader', 'POST', '/items', {
        title: 1,
      }),
    ).toBe(403);
    expect(
      await statusFor(authorized, 'writer', 'POST', '/items', {
        title: 1,
      }),
    ).toBe(422);
  });

  it('sees the variables the middleware set', async () => {
    expect(
      await Promise.all([
        statusFor(authorized, 'admin', 'GET', '/stats'),
        statusFor(authorized, 'reader', 'GET', '/stats'),
      ]),
    ).toEqual([200, 403]);
  });

  it('answers with the error the check throws', async () => {
    const response = await authorized.request('/items', {}, env);

    expect({
      status: response.status,
      body: await response.json(),
    }).toEqual({
      status: 401,
      body: {
        message: 'Who are you?',
      },
    });
  });

  it("adds the check's errors to every route in a record, and to no router", () => {
    expect(documented(authorized)).toEqual({
      '/items': {
        200: 'All items',
        401: 'Nobody signed in',
        403: 'The caller may not call this route',
        500: 'Something failed on the server',
      },
      '/stats': {
        200: 'How many items there are',
        401: 'Nobody signed in',
        403: 'Only an admin may read them',
        500: 'Something failed on the server',
      },
      '/ping': {
        200: 'Pong',
      },
    });
    expect(
      Object.keys(
        documentOf(authorized).paths?.['/items']?.post?.responses ?? {},
      ),
    ).toEqual(['201', '400', '401', '403', '415', '422', '500']);
  });

  it('leaves an app without it as it was, whatever access its routes give', async () => {
    const { route, handler } = createItem;
    const withAccess = createApp({
      routes: {
        '/items': {
          createItem,
        },
      },
    });
    const withoutAccess = createApp({
      routes: {
        '/items': {
          createItem: {
            route,
            handler,
          },
        },
      },
    });

    expect(documentOf(withAccess)).toEqual(documentOf(withoutAccess));
    expect(
      await Promise.all([
        statusFor(withAccess, 'Nobody', 'POST', '/items', {
          title: 'Milk',
        }),
        statusFor(withAccess, 'Nobody', 'POST', '/items', {
          title: 1,
        }),
      ]),
    ).toEqual([201, 422]);
  });

  it('takes only an access the API registers', () => {
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      // @ts-expect-error: admin isn't a registered access
      access: 'admin',
      handler: () => new Response(),
    });
    defineAuthorize(
      (_, access) => {
        expectTypeOf(access).toEqualTypeOf<'read' | 'write' | undefined>();
      },
      {
        errors: {
          // @ts-expect-error: onError's 500 is Kiln's
          500: 'Something failed',
        },
      },
    );
  });
});
