import { z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { hc } from 'hono/client';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { NotFound } from '#/http/http.errors.ts';
import { defineRoute } from '#/http/http.route.ts';

import type { InferRequestType, InferResponseType } from 'hono/client';

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
});

const getItem = defineRoute({
  method: 'get',
  path: '/{id}',
  params: z.object({
    id: z.uuid(),
  }),
  response: itemSchema,
  description: 'One item',
  errors: {
    404: 'Cannot find item',
  },
  handler: (c) => {
    const { id } = c.req.valid('param');

    if (id === '00000000-0000-4000-8000-000000000000') {
      throw new NotFound('Item not found');
    }

    if (id === '00000000-0000-4000-8000-000000000001') {
      throw new Error('the database password');
    }

    return c.json(
      {
        id,
        title: c.var.user,
      },
      200,
    );
  },
});

const getAllItems = defineRoute({
  method: 'get',
  path: '/',
  response: z.array(itemSchema),
  description: 'All items',
  handler: (c) => c.json([], 200),
});

const createItem = defineRoute({
  method: 'post',
  path: '/',
  body: {
    schema: z.strictObject({
      title: z.string(),
    }),
    description: 'Item to create',
  },
  status: 201,
  response: itemSchema,
  description: 'Item created',
  handler: (c) =>
    c.json(
      {
        id: crypto.randomUUID(),
        title: c.req.valid('json').title,
      },
      201,
    ),
});

const deleteItem = defineRoute({
  method: 'delete',
  path: '/{id}',
  params: z.object({
    id: z.uuid(),
  }),
  status: 204,
  description: 'Item deleted',
  handler: (c) => c.newResponse(null, 204),
});

const itemsRoutes = {
  getItem,
  getAllItems,
  createItem,
  deleteItem,
};

const app = createApp({
  middleware: [
    async (c, next) => {
      c.set('user', 'Ada');

      return next();
    },
  ],
  routes: {
    '/items': itemsRoutes,
  },
});

const document = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: {
    title: 'Items',
    version: '1.0.0',
  },
});

// A path's operation in the document, by its method
const operation = (path: string, method: 'get' | 'post' | 'delete') =>
  document.paths?.[path]?.[method];

const statuses = (path: string, method: 'get' | 'post' | 'delete') =>
  Object.keys(operation(path, method)?.responses ?? {});

describe('the responses it declares', () => {
  it('adds a 500 to every route, and nothing else to one with no request', () => {
    expect(statuses('/items', 'get')).toEqual(['200', '500']);
  });

  it('adds a 422 to a route with a request schema', () => {
    expect(statuses('/items/{id}', 'get')).toEqual([
      '200',
      '404',
      '422',
      '500',
    ]);
  });

  it('adds a 400 and a 415 to a route with a body, beside the 422', () => {
    expect(statuses('/items', 'post')).toEqual([
      '201',
      '400',
      '415',
      '422',
      '500',
    ]);
  });

  it('gives the success its status and description, and no body for a 204', () => {
    expect(operation('/items/{id}', 'delete')?.responses?.['204']).toEqual({
      description: 'Item deleted',
    });
    expect(operation('/items', 'post')?.responses?.['201']?.description).toBe(
      'Item created',
    );
  });

  it('makes a body required JSON, with its description', () => {
    expect(operation('/items', 'post')?.requestBody).toMatchObject({
      required: true,
      description: 'Item to create',
      content: {
        'application/json': {},
      },
    });
  });

  it("names each route's operation by its key", () => {
    expect([
      operation('/items/{id}', 'get')?.operationId,
      operation('/items', 'get')?.operationId,
      operation('/items', 'post')?.operationId,
      operation('/items/{id}', 'delete')?.operationId,
    ]).toEqual(['getItem', 'getAllItems', 'createItem', 'deleteItem']);
  });
});

const request = async (path: string, init: RequestInit = {}) => {
  const response = await app.request(path, init, env);

  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  };
};

describe('what it answers', () => {
  it('runs the handler with the request it validated', async () => {
    expect(
      await request('/items', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Milk',
        }),
      }),
    ).toMatchObject({
      status: 201,
      body: {
        title: 'Milk',
      },
    });
  });

  it('answers each status it declares, and no other', async () => {
    const answered = await Promise.all([
      request('/items/00000000-0000-4000-8000-000000000000'),
      request('/items/00000000-0000-4000-8000-000000000001'),
      request('/items/not-a-uuid'),
      request('/items', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '{',
      }),
      request('/items', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
        },
        body: 'Milk',
      }),
      request('/items', {
        method: 'POST',
      }),
    ]);

    expect(answered.map(({ status }) => status)).toEqual([
      404, 500, 422, 400, 415, 422,
    ]);
  });
});

describe('registering a record', () => {
  const getNew = defineRoute({
    method: 'get',
    path: '/new',
    response: z.string(),
    description: 'The new item form',
    handler: (c) => c.json('new', 200),
  });

  const getOne = defineRoute({
    method: 'get',
    path: '/{id}',
    params: z.object({
      id: z.string(),
    }),
    response: z.string(),
    description: 'One item',
    handler: (c) => c.json('one', 200),
  });

  it('registers routes in its key order, which decides overlapping paths', async () => {
    const newFirst = createApp({
      routes: {
        '/': {
          getNew,
          getOne,
        },
      },
    });
    const oneFirst = createApp({
      routes: {
        '/': {
          getOne,
          getNew,
        },
      },
    });

    expect([
      await (await newFirst.request('/new', {}, env)).json(),
      await (await oneFirst.request('/new', {}, env)).json(),
    ]).toEqual(['new', 'one']);
  });
});

describe('its types', () => {
  // The typed client leans on zod-openapi's openapiRoutes, whose types give a
  // tuple's routes and drop an array's: these fail if an upgrade changes that
  const client = hc<typeof app>('http://localhost');

  it('gives a typed client every route in a record, with its bodies', () => {
    expectTypeOf<
      InferResponseType<(typeof client.items)[':id']['$get'], 200>
    >().toEqualTypeOf<{
      id: string;
      title: string;
    }>();
    expectTypeOf<
      InferResponseType<typeof client.items.$get, 200>
    >().toEqualTypeOf<
      {
        id: string;
        title: string;
      }[]
    >();
    expectTypeOf<InferRequestType<typeof client.items.$post>>().toEqualTypeOf<{
      json: {
        title: string;
      };
    }>();
    expectTypeOf<
      InferResponseType<(typeof client.items)[':id']['$get'], 404>
    >().toEqualTypeOf<{
      message: string;
    }>();

    // @ts-expect-error: no route is at /other
    void client.other;

    // A type only: calling the client would send the request
    const wrongBody: InferRequestType<typeof client.items.$post> = {
      json: {
        // @ts-expect-error: a title is a string
        title: 1,
      },
    };

    void wrongBody;
  });

  it('types the handler by its route', () => {
    defineRoute({
      method: 'post',
      path: '/{id}',
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        title: z.string(),
      }),
      response: itemSchema,
      description: 'An item',
      errors: {
        409: 'Item already exists',
      },
      handler: (c) => {
        expectTypeOf(c.req.valid('param')).toEqualTypeOf<{
          id: string;
        }>();
        expectTypeOf(c.req.valid('json')).toEqualTypeOf<{
          title: string;
        }>();
        expectTypeOf(c.var.user).toEqualTypeOf<string>();

        return c.json(
          {
            message: 'Item already exists',
          },
          409,
        );
      },
    });
    defineRoute({
      method: 'get',
      path: '/',
      response: itemSchema,
      description: 'An item',
      handler: (c) =>
        // @ts-expect-error: 403 isn't one of the route's responses
        c.json(
          {
            message: 'Who are you?',
          },
          403,
        ),
    });
  });

  it('refuses an error Kiln declares itself', () => {
    const route = {
      method: 'post',
      path: '/',
      body: z.object({}),
      description: 'Nothing',
      handler: () => new Response(),
    } as const;

    defineRoute({
      ...route,
      // @ts-expect-error: onError's 500 is Kiln's
      errors: {
        500: 'Something failed',
      },
    });
    defineRoute({
      ...route,
      errors: {
        // @ts-expect-error: the validation hook's 422 is Kiln's
        422: 'Invalid',
      },
    });
    defineRoute({
      ...route,
      // @ts-expect-error: with a body, a 400 that isn't JSON is Kiln's
      errors: {
        400: 'Bad body',
      },
    });
    defineRoute({
      ...route,
      // @ts-expect-error: with a body, a 415 is Kiln's
      errors: {
        415: 'Not JSON',
      },
    });
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      errors: {
        400: "A 400 of the route's own, with no body",
      },
      handler: () => new Response(),
    });
  });

  it('refuses a response schema for a 204', () => {
    defineRoute({
      method: 'delete',
      path: '/',
      status: 204,
      // @ts-expect-error: a 204 has no body
      response: itemSchema,
      description: 'Deleted',
      handler: (c) => c.newResponse(null, 204),
    });
  });
});
