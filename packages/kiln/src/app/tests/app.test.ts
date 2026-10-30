import { z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { hc } from 'hono/client';
import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { defineMiddleware } from '#/http/http.middleware.ts';
import { definePolicy } from '#/http/http.policy.ts';
import { defineRoute } from '#/http/http.route.ts';
import { createRouter } from '#/http/http.router.ts';

import type { OptionsArgs } from '#/app/app.ts';
import type { EnforceResponse, PolicyOption } from '#/http/http.policy.ts';
import type { AppEnv, Policy, PolicyOf } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';
import type { InferResponseType } from 'hono/client';

// Every route lets every caller in, for tests about anything but the policy,
// which the tests' registration makes every app give
const allowAll = {
  enforce: () => undefined,
};

// The variables http.types.test.ts registers for every test, set as an API's
// middleware sets its own: who's asking
const setUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', c.req.header('user') ?? 'Nobody');

  await next();
};

const getItem = defineRoute({
  method: 'get',
  path: '/{id}',
  params: z.object({
    id: z.uuid('Id must be a uuid'),
  }),
  response: z.object({
    id: z.string(),
    user: z.string(),
  }),
  description: 'One item',
  errors: {
    notFound: 'Cannot find item',
  },
  policy: 'read',
  handler: (c, errors) => {
    const { id } = c.req.valid('param');

    if (id === '00000000-0000-4000-8000-000000000000') return errors.notFound();

    return c.json(
      {
        id,
        user: c.var.user,
      },
      200,
    );
  },
});

const whoami = defineRoute({
  method: 'get',
  path: '/whoami',
  response: z.object({
    user: z.string(),
  }),
  description: "Who's asking",
  policy: 'read',
  handler: (c) =>
    c.json(
      {
        user: c.var.user,
      },
      200,
    ),
});

// An API wired by createApp alone, with no type arguments: a middleware that
// says who's asking, and records at two paths, one of them the root
const app = createApp({
  middleware: [setUser],
  policy: allowAll,
  routes: {
    '/items': {
      getItem,
    },
    '/': {
      whoami,
    },
  },
});

const answer = async (
  to: OpenAPIHono<AppEnv>,
  path: string,
  init: RequestInit = {},
) => {
  const response = await to.request(path, init, env);

  return {
    status: response.status,
    body: await response.json(),
  };
};

const client = hc<typeof app>('http://localhost', {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
    app.request(input, init, env),
  headers: {
    user: 'Ada',
  },
});

// Types only: an app that mounted them would fail as it registered them
const mountsOther = () => [
  createApp({
    policy: allowAll,
    routes: {
      // @ts-expect-error: a router isn't a record of routes
      '/': createRouter(),
    },
  }),
  createApp({
    policy: allowAll,
    routes: {
      '/': {
        whoami,
        // @ts-expect-error: nor is anything in a record but a route
        other: async () => new Response(),
      },
    },
  }),
];

describe('the app', () => {
  it('answers a request its schema refuses with a 422 and its issues', async () => {
    expect(await answer(app, '/items/not-a-uuid')).toEqual({
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

  it('answers a path no route has with a 404', async () => {
    expect(await answer(app, '/nothing')).toEqual({
      status: 404,
      body: {
        message: 'Not Found',
      },
    });
  });

  it('registers each record at its path, after the middleware', async () => {
    const item = await client.items[':id'].$get({
      param: {
        id: '00000000-0000-4000-8000-000000000001',
      },
    });
    const missing = await client.items[':id'].$get({
      param: {
        id: '00000000-0000-4000-8000-000000000000',
      },
    });
    const me = await client.whoami.$get();

    expect([await item.json(), await missing.json(), await me.json()]).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        user: 'Ada',
      },
      {
        message: 'Cannot find item',
      },
      {
        user: 'Ada',
      },
    ]);
  });

  it('gives a typed client every route it registers, errors too, and no other', () => {
    expectTypeOf<
      InferResponseType<(typeof client.items)[':id']['$get'], 200>
    >().toEqualTypeOf<{
      id: string;
      user: string;
    }>();
    expectTypeOf<
      InferResponseType<(typeof client.items)[':id']['$get'], 404>
    >().toEqualTypeOf<{
      message: string;
    }>();
    expectTypeOf<
      InferResponseType<typeof client.whoami.$get, 200>
    >().toEqualTypeOf<{
      user: string;
    }>();

    // @ts-expect-error: no route is at /other
    void client.other;
  });

  it('mounts records of routes, and nothing else', () => {
    void mountsOther;
  });
});

// Each operation in an app's document, by path and method: its statuses and
// what each one means
const documentOf = (from: OpenAPIHono<AppEnv>) =>
  from.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Items',
      version: '1.0.0',
    },
  });

const documented = (
  from: OpenAPIHono<AppEnv>,
  method: 'get' | 'post' = 'get',
) => {
  const { paths = {} } = documentOf(from);

  return Object.fromEntries(
    Object.entries(paths).map(([path, item]) => [
      path,
      Object.fromEntries(
        Object.entries(item[method]?.responses ?? {}).map(
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

describe('a middleware', () => {
  // An auth guard: it answers a 401 or a 403, or lets the request through
  const guard = defineMiddleware({
    errors: {
      unauthorized: 'No token was sent',
      forbidden: 'The token was refused',
    },
    handler: async (c, next, errors) => {
      const token = c.req.header('authorization');

      if (!token) return errors.unauthorized();
      if (token !== 'Bearer good') return errors.forbidden('Bad token');

      return next();
    },
  });

  // How many requests reached a route
  let reached = 0;

  const listItems = defineRoute({
    method: 'get',
    path: '/',
    response: z.array(z.string()),
    description: 'All items',
    policy: 'read',
    handler: (c) => {
      reached += 1;

      return c.json([c.var.user], 200);
    },
  });

  const getSecret = defineRoute({
    method: 'get',
    path: '/',
    response: z.string(),
    description: 'The secret',
    errors: {
      forbidden: 'Only an admin may read it',
    },
    policy: 'read',
    handler: (c, errors) =>
      c.var.user === 'admin' ? c.json('secret', 200) : errors.forbidden(),
  });

  const itemsRoutes = {
    listItems,
  };

  const guarded = createApp({
    middleware: [setUser, guard],
    policy: allowAll,
    routes: {
      '/items': itemsRoutes,
      '/secret': {
        getSecret,
      },
    },
  });

  const send = async (authorization?: string) =>
    answer(guarded, '/items', {
      headers: {
        user: 'Ada',
        ...(authorization
          ? {
              authorization,
            }
          : {}),
      },
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ends the request with an error it returns', async () => {
    reached = 0;

    expect(await Promise.all([send(), send('Bearer bad')])).toEqual([
      {
        status: 401,
        body: {
          message: 'No token was sent',
        },
      },
      {
        status: 403,
        body: {
          message: 'Bad token',
        },
      },
    ]);
    expect(reached).toBe(0);
  });

  it('lets the request through, after a plain handler before it', async () => {
    expect(await send('Bearer good')).toEqual({
      status: 200,
      body: ['Ada'],
    });
  });

  it('makes what it throws a 500 that says nothing of it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const throwing = createApp({
      middleware: [
        defineMiddleware({
          handler: () => {
            throw new Error('the database password');
          },
        }),
      ],
      policy: allowAll,
      routes: {
        '/items': itemsRoutes,
      },
    });

    expect(await answer(throwing, '/items')).toEqual({
      status: 500,
      body: {
        message: 'Internal Server Error',
      },
    });
  });

  it("adds its errors to every route, a route's own description winning", () => {
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
    });
  });

  it('adds nothing for a plain handler', () => {
    const plain = createApp({
      middleware: [setUser],
      policy: allowAll,
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
      policy: allowAll,
      routes: {
        '/items': itemsRoutes,
      },
    });

    expect(documented(unguarded)['/items']).toEqual({
      200: 'All items',
      500: 'Something failed on the server',
    });
  });

  it('checks its errors against what its handler returns', () => {
    defineMiddleware({
      errors: {
        unauthorized: 'No token was sent',
        // @ts-expect-error: forbidden is declared but never returned
        forbidden: 'The token was refused',
      },
      handler: async (c, next, errors) =>
        c.req.header('authorization') ? next() : errors.unauthorized(),
    });
    defineMiddleware({
      errors: {
        unauthorized: 'No token was sent',
      },
      handler: async (c, next, errors) => {
        // @ts-expect-error: forbidden isn't declared
        void errors.forbidden;

        return c.req.header('authorization') ? next() : errors.unauthorized();
      },
    });
    defineMiddleware({
      errors: {
        // @ts-expect-error: onError's 500 is Kiln's
        internalServerError: 'Something failed',
      },
      handler: async (_, next) => next(),
    });
  });
});

// What an app answers a caller, by name, with a body or none
const call = async (
  to: OpenAPIHono<AppEnv>,
  user: string,
  method: string,
  path: string,
  body?: unknown,
) =>
  answer(to, path, {
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
  });

// A policy in a file of its own: only an admin may write
const readOnly = definePolicy({
  errors: {
    forbidden: 'The caller may not call this route',
  },
  enforce: (c, policy, errors) =>
    policy === 'write' && c.var.user !== 'admin'
      ? errors.forbidden()
      : undefined,
});

describe('the policy', () => {
  const readItems = defineRoute({
    method: 'get',
    path: '/',
    response: z.array(z.string()),
    description: 'All items',
    policy: 'read',
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
    policy: 'write',
    handler: (c) => c.json(c.req.valid('json').title, 201),
  });

  const getStats = defineRoute({
    method: 'get',
    path: '/',
    response: z.number(),
    description: 'How many items there are',
    errors: {
      forbidden: 'Only an admin may read them',
    },
    policy: 'read',
    handler: (c, errors) =>
      c.var.user === 'admin' ? c.json(0, 200) : errors.forbidden(),
  });

  const routes = {
    '/items': {
      readItems,
      createItem,
    },
    '/stats': {
      getStats,
    },
  };

  const guard = defineMiddleware({
    errors: {
      unauthorized: 'No user was named',
      forbidden: 'The user was refused',
    },
    handler: async (c, next, errors) => {
      if (c.req.header('user') === 'banned') return errors.forbidden();

      return c.req.header('user') ? next() : errors.unauthorized();
    },
  });

  // A reader may read, a writer may write too. Who's calling is the
  // middleware's to say
  const policed = createApp({
    middleware: [setUser, guard],
    policy: {
      errors: {
        forbidden: 'The caller may not call this route',
      },
      enforce: (c, policy, errors) =>
        policy === 'write' && c.var.user !== 'writer'
          ? errors.forbidden('Read only')
          : undefined,
    },
    routes,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is enforced with each route's own policy, which allows or refuses", async () => {
    const seen: Policy[] = [];
    const recording = createApp({
      policy: {
        enforce: (_, policy) => {
          seen.push(policy);
        },
      },
      routes,
    });

    await recording.request('/items', {}, env);
    await recording.request('/stats', {}, env);
    await recording.request(
      '/items',
      {
        method: 'POST',
      },
      env,
    );

    expect(seen).toEqual(['read', 'read', 'write']);
  });

  it('refuses by returning an error, its message or its description', async () => {
    const asynchronous = createApp({
      middleware: [setUser],
      policy: {
        errors: {
          forbidden: 'The caller may not call this route',
        },
        enforce: async (c, _, errors) => {
          await Promise.resolve();

          return c.var.user === 'writer' ? undefined : errors.forbidden();
        },
      },
      routes,
    });

    expect(
      await Promise.all([
        call(policed, 'reader', 'GET', '/items'),
        call(policed, 'reader', 'POST', '/items', {
          title: 'Milk',
        }),
        call(policed, 'writer', 'POST', '/items', {
          title: 'Milk',
        }),
        call(asynchronous, 'reader', 'GET', '/items'),
        call(asynchronous, 'writer', 'GET', '/items'),
      ]),
    ).toEqual([
      {
        status: 200,
        body: [],
      },
      {
        status: 403,
        body: {
          message: 'Read only',
        },
      },
      {
        status: 201,
        body: 'Milk',
      },
      {
        status: 403,
        body: {
          message: 'The caller may not call this route',
        },
      },
      {
        status: 200,
        body: [],
      },
    ]);
  });

  it('runs after the middleware, so it sees what they set and they refuse first', async () => {
    expect(
      await Promise.all([
        call(policed, 'banned', 'POST', '/items', {
          title: 'Milk',
        }),
        call(policed, 'writer', 'POST', '/items', {
          title: 'Milk',
        }),
      ]),
    ).toEqual([
      {
        status: 403,
        body: {
          message: 'The user was refused',
        },
      },
      {
        status: 201,
        body: 'Milk',
      },
    ]);
  });

  it('refuses a caller before the route validates the request', async () => {
    expect(
      await Promise.all([
        call(policed, 'reader', 'POST', '/items', {
          title: 1,
        }),
        call(policed, 'writer', 'POST', '/items', {
          title: 1,
        }),
      ]),
    ).toMatchObject([
      {
        status: 403,
        body: {
          message: 'Read only',
        },
      },
      {
        status: 422,
      },
    ]);
  });

  it('makes what it throws a 500 that says nothing of it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const throwing = createApp({
      policy: {
        enforce: () => {
          throw new Error('the database password');
        },
      },
      routes,
    });

    expect(await answer(throwing, '/items')).toEqual({
      status: 500,
      body: {
        message: 'Internal Server Error',
      },
    });
  });

  it("adds its errors to every route: a route's own win, then its, then a middleware's", () => {
    expect(documented(policed)).toEqual({
      '/items': {
        200: 'All items',
        401: 'No user was named',
        403: 'The caller may not call this route',
        500: 'Something failed on the server',
      },
      '/stats': {
        200: 'How many items there are',
        401: 'No user was named',
        403: 'Only an admin may read them',
        500: 'Something failed on the server',
      },
    });
    expect(Object.keys(documented(policed, 'post')['/items'] ?? {})).toEqual([
      '201',
      '400',
      '401',
      '403',
      '415',
      '422',
      '500',
    ]);
  });

  it("says each route's policy in the document, as x-policy", () => {
    const { paths = {} } = documentOf(policed);

    expect([
      paths['/items']?.get?.['x-policy'],
      paths['/items']?.post?.['x-policy'],
      paths['/stats']?.get?.['x-policy'],
    ]).toEqual(['read', 'write', 'read']);
  });

  it('says none for routes that give none, in an app that enforces none', () => {
    const { route, handler } = readItems;
    // As an API that registers no policy builds its app: no route gives one,
    // and the app enforces none
    // @ts-expect-error: the tests register a policy, which this app leaves out
    const unpoliced = createApp({
      routes: {
        '/items': {
          readItems: {
            route,
            handler,
          },
        },
      },
    });

    expect(documentOf(unpoliced).paths?.['/items']?.get).not.toHaveProperty(
      'x-policy',
    );
  });

  it('checks its errors against what enforce returns', () => {
    createApp({
      policy: {
        errors: {
          forbidden: 'The caller may not call this route',
          // @ts-expect-error: unauthorized is declared but never returned
          unauthorized: 'Nobody signed in',
        },
        enforce: (c, _, errors) =>
          c.var.user === 'guest' ? errors.forbidden() : undefined,
      },
      routes,
    });
    createApp({
      policy: {
        errors: {
          forbidden: 'The caller may not call this route',
        },
        enforce: (c, _, errors) => {
          // @ts-expect-error: unauthorized isn't declared
          void errors.unauthorized;

          return c.var.user === 'guest' ? errors.forbidden() : undefined;
        },
      },
      routes,
    });
  });

  it('takes one definePolicy gives, as it takes one inline', async () => {
    const fromFile = createApp({
      policy: readOnly,
      routes,
    });

    expect(
      await Promise.all([
        call(fromFile, 'reader', 'GET', '/items'),
        call(fromFile, 'writer', 'POST', '/items', {
          title: 'Milk',
        }),
      ]),
    ).toEqual([
      {
        status: 200,
        body: [],
      },
      {
        status: 403,
        body: {
          message: 'The caller may not call this route',
        },
      },
    ]);
    expect(documented(fromFile)['/items']?.[403]).toBe(
      'The caller may not call this route',
    );
  });

  it('checks the errors of one definePolicy gives, as inline', () => {
    definePolicy({
      errors: {
        forbidden: 'The caller may not call this route',
        // @ts-expect-error: unauthorized is declared but never returned
        unauthorized: 'Nobody signed in',
      },
      enforce: (_, policy, errors) =>
        policy === 'write' ? errors.forbidden() : undefined,
    });
    definePolicy({
      errors: {
        forbidden: 'The caller may not call this route',
      },
      enforce: (_, policy, errors) => {
        // @ts-expect-error: unauthorized isn't declared
        void errors.unauthorized;

        return policy === 'write' ? errors.forbidden() : undefined;
      },
    });
    definePolicy({
      errors: {
        // @ts-expect-error: onError's 500 is Kiln's
        internalServerError: 'Something failed',
      },
      enforce: () => undefined,
    });
    definePolicy({
      enforce: (_, policy) => {
        expectTypeOf(policy).toEqualTypeOf<'read' | 'write'>();
      },
    });
  });

  it("gives enforce the route's policy, never undefined", () => {
    createApp({
      policy: {
        enforce: (_, policy) => {
          expectTypeOf(policy).toEqualTypeOf<'read' | 'write'>();
        },
      },
      routes,
    });
  });

  it('is needed when one is registered', () => {
    // @ts-expect-error: a policy is registered, so the app enforces one
    createApp({
      routes,
    });
    // @ts-expect-error: and createApp can't be called with nothing
    createApp();
  });

  it('is refused when none is registered', () => {
    type Unregistered = PolicyOf<{}>;

    expectTypeOf<
      PolicyOption<Unregistered, never, EnforceResponse<never>>
    >().toEqualTypeOf<{
      policy?: never;
    }>();

    const given: PolicyOption<Unregistered, never, EnforceResponse<never>> = {
      // @ts-expect-error: with nothing registered, the app enforces nothing
      policy: allowAll,
    };
    // With nothing registered, createApp can be called with nothing
    const none: OptionsArgs<
      Unregistered,
      {},
      never,
      EnforceResponse<never>
    > = [];

    void [given, none];
  });
});

// A PUT with a body as given, raw, so it can be malformed
const put = async (
  to: OpenAPIHono<AppEnv>,
  user: string,
  path: string,
  body: string,
) =>
  answer(to, path, {
    method: 'PUT',
    headers: {
      user,
      'content-type': 'application/json',
    },
    body,
  });

describe('a paramPolicy', () => {
  const setPriority = defineRoute({
    method: 'put',
    path: '/{id}/priority',
    params: z.object({
      id: z.uuid(),
    }),
    body: z.strictObject({
      priority: z.enum(['low', 'high']),
    }),
    response: z.string(),
    description: 'Priority set',
    policy: 'write',
    paramPolicy: {
      body: {
        priority: {
          low: 'read',
        },
      },
    },
    handler: (c) => c.json(c.req.valid('json').priority, 200),
  });

  // A discriminated union's discriminator, each option with a literal for it
  const setStatus = defineRoute({
    method: 'put',
    path: '/{id}/status',
    body: z.discriminatedUnion('status', [
      z.strictObject({
        status: z.literal('open'),
      }),
      z.strictObject({
        status: z.literal('closed'),
        reason: z.string(),
      }),
    ]),
    response: z.string(),
    description: 'Status set',
    policy: 'write',
    paramPolicy: {
      body: {
        status: {
          open: 'read',
        },
      },
    },
    handler: (c) => c.json(c.req.valid('json').status, 200),
  });

  // A query parameter with a default, which an omitted one reads as
  const listItems = defineRoute({
    method: 'get',
    path: '/',
    query: z.object({
      view: z.enum(['summary', 'full']).default('summary'),
    }),
    response: z.string(),
    description: 'All items',
    policy: 'write',
    paramPolicy: {
      query: {
        view: {
          summary: 'read',
        },
      },
    },
    handler: (c) => c.json(c.req.valid('query').view, 200),
  });

  const routes = {
    '/items': {
      listItems,
      setPriority,
      setStatus,
    },
  };

  const id = '00000000-0000-4000-8000-000000000002';

  // Only a writer may write, and enforce says which policy it was given
  const recorded = () => {
    const seen: Policy[] = [];
    const policed = createApp({
      middleware: [setUser],
      policy: {
        errors: {
          forbidden: 'The caller may not call this route',
        },
        enforce: (c, policy, errors) => {
          seen.push(policy);

          return policy === 'write' && c.var.user !== 'writer'
            ? errors.forbidden()
            : undefined;
        },
      },
      routes,
    });

    return {
      seen,
      policed,
    };
  };

  // The policies enforce was given for one request, on an app of its own
  const policiesFor = async (
    request: (to: OpenAPIHono<AppEnv>) => Promise<unknown>,
  ) => {
    const { seen, policed } = recorded();

    await request(policed);

    return seen;
  };

  const priority = async (body: string) =>
    policiesFor(async (to) => put(to, 'reader', `/items/${id}/priority`, body));

  const view = async (query: string) =>
    policiesFor(async (to) =>
      answer(to, `/items${query}`, {
        headers: {
          user: 'reader',
        },
      }),
    );

  it("enforces a listed value's case, and the route's policy for anything else", async () => {
    expect(
      await Promise.all(
        [
          '{"priority":"low"}',
          '{"priority":"high"}',
          '{}',
          '{"priority":1}',
          '{"priority":"LOW"}',
          '["low"]',
          '"low"',
          '{"priority":',
        ].map(priority),
      ),
    ).toEqual([
      ['read'],
      ['write'],
      ['write'],
      ['write'],
      ['write'],
      ['write'],
      ['write'],
      ['write'],
    ]);
  });

  it('runs enforce once per request', async () => {
    const counts = await Promise.all(
      [
        async (to: OpenAPIHono<AppEnv>) =>
          put(to, 'reader', `/items/${id}/priority`, '{"priority":"low"}'),
        async (to: OpenAPIHono<AppEnv>) =>
          put(to, 'writer', `/items/${id}/priority`, '{"priority":"high"}'),
        async (to: OpenAPIHono<AppEnv>) =>
          put(to, 'reader', `/items/${id}/priority`, '{"priority":"high"}'),
        async (to: OpenAPIHono<AppEnv>) =>
          put(to, 'writer', `/items/${id}/priority`, '{"priority":1}'),
        async (to: OpenAPIHono<AppEnv>) =>
          answer(to, '/items?view=full', {
            headers: {
              user: 'writer',
            },
          }),
      ].map(async (request) => (await policiesFor(request)).length),
    );

    expect(counts).toEqual([1, 1, 1, 1, 1]);
  });

  it('refuses a caller before validation, and lets an allowed one reach it', async () => {
    const { policed } = recorded();

    expect(
      await Promise.all([
        put(
          policed,
          'reader',
          `/items/${id}/priority`,
          '{"priority":"high","extra":1}',
        ),
        put(
          policed,
          'writer',
          `/items/${id}/priority`,
          '{"priority":"high","extra":1}',
        ),
        put(
          policed,
          'reader',
          `/items/${id}/priority`,
          '{"priority":"low","extra":1}',
        ),
        put(
          policed,
          'reader',
          '/items/not-a-uuid/priority',
          '{"priority":"high"}',
        ),
        put(policed, 'reader', `/items/${id}/priority`, '{"priority":'),
        put(policed, 'writer', `/items/${id}/priority`, '{"priority":'),
      ]),
    ).toMatchObject([
      {
        status: 403,
      },
      {
        status: 422,
      },
      {
        status: 422,
      },
      {
        status: 403,
      },
      {
        status: 403,
      },
      {
        status: 400,
      },
    ]);
  });

  it('leaves the body for the route to validate and read', async () => {
    const { policed } = recorded();

    expect(
      await Promise.all([
        put(policed, 'reader', `/items/${id}/priority`, '{"priority":"low"}'),
        put(policed, 'writer', `/items/${id}/priority`, '{"priority":"high"}'),
      ]),
    ).toEqual([
      {
        status: 200,
        body: 'low',
      },
      {
        status: 200,
        body: 'high',
      },
    ]);
  });

  it("reads a discriminated union's discriminator from its options", async () => {
    const { policed } = recorded();
    const status = async (body: string) =>
      policiesFor(async (to) => put(to, 'reader', `/items/${id}/status`, body));

    expect(
      await Promise.all([
        put(policed, 'reader', `/items/${id}/status`, '{"status":"open"}'),
        put(
          policed,
          'reader',
          `/items/${id}/status`,
          '{"status":"closed","reason":"Done"}',
        ),
        put(
          policed,
          'writer',
          `/items/${id}/status`,
          '{"status":"closed","reason":"Done"}',
        ),
      ]),
    ).toMatchObject([
      {
        status: 200,
        body: 'open',
      },
      {
        status: 403,
      },
      {
        status: 200,
        body: 'closed',
      },
    ]);
    expect(
      await Promise.all(
        [
          '{"status":"open"}',
          '{"status":"closed"}',
          '{"status":"pending"}',
        ].map(status),
      ),
    ).toEqual([['read'], ['write'], ['write']]);
  });

  it('reads a query parameter, its default for one left out', async () => {
    expect(
      await Promise.all(
        ['', '?view=summary', '?view=full', '?view=summary&view=full'].map(
          view,
        ),
      ),
    ).toEqual([['read'], ['read'], ['write'], ['write']]);
  });

  it('says each paramPolicy in the document, as x-param-policy', () => {
    const { paths = {} } = documentOf(recorded().policed);

    expect([
      paths['/items/{id}/priority']?.put?.['x-param-policy'],
      paths['/items']?.get?.['x-param-policy'],
      paths['/items']?.get?.['x-policy'],
    ]).toEqual([
      {
        in: 'body',
        name: 'priority',
        cases: {
          low: 'read',
        },
      },
      {
        in: 'query',
        name: 'view',
        cases: {
          summary: 'read',
        },
      },
      'write',
    ]);
  });

  it('names one parameter of the route, and values it can take', () => {
    const route = {
      method: 'put',
      path: '/{id}',
      params: z.object({
        id: z.uuid(),
        kind: z.enum(['a', 'b']),
      }),
      body: z.object({
        priority: z.enum(['low', 'high']),
        title: z.string(),
        count: z.number(),
      }),
      description: 'Set',
      policy: 'write',
      handler: (c: Context) => c.body(null, 200),
    } as const;

    // Types only: defineRoute throws for a paramPolicy past them
    const typesOnly = () => {
      defineRoute({
        ...route,
        paramPolicy: {
          params: {
            kind: {
              a: 'read',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          body: {
            // @ts-expect-error: the body has no parameter called urgency
            urgency: {
              low: 'read',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          body: {
            priority: {
              // @ts-expect-error: priority can't be medium
              medium: 'read',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          body: {
            priority: {
              // @ts-expect-error: a case is the registered policy
              low: 'admin',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          body: {
            // @ts-expect-error: title's values aren't string literals
            title: {
              low: 'read',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          body: {
            // @ts-expect-error: nor are count's
            count: {
              1: 'read',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          body: {
            priority: {
              low: 'read',
            },
            // @ts-expect-error: one parameter
            title: {},
          },
        },
      });
      defineRoute({
        ...route,
        // @ts-expect-error: in one location
        paramPolicy: {
          params: {
            kind: {
              a: 'read',
            },
          },
          body: {
            priority: {
              low: 'read',
            },
          },
        },
      });
      defineRoute({
        ...route,
        paramPolicy: {
          // @ts-expect-error: the route takes no query
          query: {
            view: {
              summary: 'read',
            },
          },
        },
      });
    };

    void typesOnly;
  });

  it('throws for a paramPolicy past its types', () => {
    expect(() =>
      defineRoute({
        method: 'get',
        path: '/',
        description: 'Nothing',
        policy: 'write',
        paramPolicy: {
          // @ts-expect-error: the route has no request schema to name
          query: {
            view: {
              summary: 'read',
            },
          },
        },
        handler: (c) => c.body(null, 200),
      }),
    ).toThrow(
      "paramPolicy names exactly one parameter of one of the route's request schemas",
    );
  });
});
