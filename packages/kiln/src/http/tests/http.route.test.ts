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
import { defineRoute } from '#/http/http.route.ts';

import type { PolicyField } from '#/http/http.route.ts';
import type { PolicyOf } from '#/http/http.types.ts';
import type { InferRequestType, InferResponseType } from 'hono/client';

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
});

// An operation as a route calls one: it returns what it found, or nothing
const findItem = async (id: string) => {
  if (id === '00000000-0000-4000-8000-000000000001') {
    throw new Error('the database password');
  }

  return id === '00000000-0000-4000-8000-000000000000'
    ? undefined
    : {
        id,
        title: 'Milk',
      };
};

const getItem = defineRoute({
  method: 'get',
  path: '/{id}',
  params: z.object({
    id: z.uuid(),
  }),
  response: itemSchema,
  description: 'One item',
  errors: {
    notFound: 'Cannot find item',
  },
  policy: 'read',
  handler: async (c, errors) => {
    const item = await findItem(c.req.valid('param').id);

    if (!item) return errors.notFound();

    return c.json(item, 200);
  },
});

const getAllItems = defineRoute({
  method: 'get',
  path: '/',
  response: z.array(itemSchema),
  description: 'All items',
  policy: 'read',
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
  errors: {
    conflict: 'Item already exists',
  },
  policy: 'write',
  handler: (c, errors) => {
    const { title } = c.req.valid('json');

    if (title === 'Milk') return errors.conflict('Milk is on the list');

    return c.json(
      {
        id: crypto.randomUUID(),
        title,
      },
      201,
    );
  },
});

const deleteItem = defineRoute({
  method: 'delete',
  path: '/{id}',
  params: z.object({
    id: z.uuid(),
  }),
  status: 204,
  description: 'Item deleted',
  errors: {
    notFound: 'Cannot find item',
  },
  policy: 'write',
  handler: async (c, errors) => {
    const item = await findItem(c.req.valid('param').id);

    if (!item) return errors.notFound();

    return c.newResponse(null, 204);
  },
});

const itemsRoutes = {
  getItem,
  getAllItems,
  createItem,
  deleteItem,
};

const app = createApp({
  policy: {
    enforce: () => undefined,
  },
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

  it("gives each declared error its name's status and its description", () => {
    expect(operation('/items/{id}', 'get')?.responses?.['404']).toMatchObject({
      description: 'Cannot find item',
      content: {
        'application/json': {},
      },
    });
    expect(operation('/items', 'post')?.responses?.['409']?.description).toBe(
      'Item already exists',
    );
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
      '409',
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

const post = (body: string, type = 'application/json') =>
  request('/items', {
    method: 'POST',
    headers: {
      'content-type': type,
    },
    body,
  });

describe('what it answers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the handler with the request it validated', async () => {
    expect(
      await post(
        JSON.stringify({
          title: 'Eggs',
        }),
      ),
    ).toMatchObject({
      status: 201,
      body: {
        title: 'Eggs',
      },
    });
  });

  it('answers an error returned with its description, or the message given', async () => {
    expect(
      await Promise.all([
        request('/items/00000000-0000-4000-8000-000000000000'),
        request('/items/00000000-0000-4000-8000-000000000000', {
          method: 'DELETE',
        }),
        post(
          JSON.stringify({
            title: 'Milk',
          }),
        ),
      ]),
    ).toEqual([
      {
        status: 404,
        body: {
          message: 'Cannot find item',
        },
      },
      {
        status: 404,
        body: {
          message: 'Cannot find item',
        },
      },
      {
        status: 409,
        body: {
          message: 'Milk is on the list',
        },
      },
    ]);
  });

  it('makes what an operation throws a 500 that says nothing of it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      await request('/items/00000000-0000-4000-8000-000000000001'),
    ).toEqual({
      status: 500,
      body: {
        message: 'Internal Server Error',
      },
    });
  });

  it("answers Kiln's own 422, 400 and 415 as they always were", async () => {
    expect(
      await Promise.all([
        request('/items/not-a-uuid'),
        post('{'),
        post('Milk', 'text/plain'),
      ]),
    ).toEqual([
      {
        status: 422,
        body: {
          message: 'Invalid Request',
          issues: [
            {
              in: 'path',
              path: 'id',
              message: 'Invalid UUID',
            },
          ],
        },
      },
      {
        status: 400,
        body: {
          message: 'Malformed JSON in request body',
        },
      },
      {
        status: 415,
        body: {
          message: 'Unsupported Media Type',
        },
      },
    ]);
  });
});

describe('registering a record', () => {
  const getNew = defineRoute({
    method: 'get',
    path: '/new',
    response: z.string(),
    description: 'The new item form',
    policy: 'read',
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
    policy: 'read',
    handler: (c) => c.json('one', 200),
  });

  it('registers routes in its key order, which decides overlapping paths', async () => {
    const policy = {
      enforce: () => undefined,
    };
    const newFirst = createApp({
      policy,
      routes: {
        '/': {
          getNew,
          getOne,
        },
      },
    });
    const oneFirst = createApp({
      policy,
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

  it('gives a typed client every route in a record, with its bodies and errors', () => {
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
    expectTypeOf<
      InferResponseType<typeof client.items.$post, 409>
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

  it('types the handler by its route, and its errors by their names', () => {
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
        conflict: 'Item already exists',
      },
      policy: 'write',
      handler: (c, errors) => {
        expectTypeOf(c.req.valid('param')).toEqualTypeOf<{
          id: string;
        }>();
        expectTypeOf(c.req.valid('json')).toEqualTypeOf<{
          title: string;
        }>();
        expectTypeOf(c.var.user).toEqualTypeOf<string>();
        expectTypeOf(errors).toHaveProperty('conflict');

        return errors.conflict();
      },
    });
    defineRoute({
      method: 'get',
      path: '/',
      response: itemSchema,
      description: 'An item',
      policy: 'read',
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

  it('refuses a name it did not declare', () => {
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      errors: {
        notFound: 'Cannot find item',
      },
      policy: 'read',
      handler: (c, errors) => {
        // @ts-expect-error: conflict isn't declared
        void errors.conflict;

        return errors.notFound();
      },
    });
  });

  it('refuses a name it declared and never returns', () => {
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      errors: {
        notFound: 'Cannot find item',
        // @ts-expect-error: conflict is declared but never returned
        conflict: 'Item already exists',
      },
      policy: 'read',
      handler: (c, errors) =>
        Math.random() > 0.5 ? errors.notFound() : c.body(null, 200),
    });
    defineRoute({
      method: 'delete',
      path: '/',
      status: 204,
      description: 'Nothing',
      errors: {
        // @ts-expect-error: notFound is declared but never returned
        notFound: 'Cannot find item',
      },
      policy: 'write',
      handler: (c) => c.newResponse(null, 204),
    });
  });

  it('refuses an error Kiln declares itself, and a name that is no error', () => {
    const route = {
      method: 'post',
      path: '/',
      body: z.object({}),
      description: 'Nothing',
      policy: 'write',
      handler: () => new Response(),
    } as const;

    defineRoute({
      ...route,
      errors: {
        // @ts-expect-error: onError's 500 is Kiln's
        internalServerError: 'Something failed',
      },
    });
    defineRoute({
      ...route,
      errors: {
        // @ts-expect-error: the validation hook's 422 is Kiln's
        unprocessableContent: 'Invalid',
      },
    });
    defineRoute({
      ...route,
      errors: {
        // @ts-expect-error: with a body, a 400 that isn't JSON is Kiln's
        badRequest: 'Bad body',
      },
    });
    defineRoute({
      ...route,
      errors: {
        // @ts-expect-error: with a body, a 415 is Kiln's
        unsupportedMediaType: 'Not JSON',
      },
    });
    defineRoute({
      ...route,
      errors: {
        // @ts-expect-error: notAnError is no error's name
        notAnError: 'Something',
      },
    });
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      errors: {
        badRequest: "A 400 of the route's own, with no body",
      },
      policy: 'read',
      handler: (c, errors) =>
        Math.random() > 0.5 ? errors.badRequest() : c.body(null, 200),
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
      policy: 'write',
      handler: (c) => c.newResponse(null, 204),
    });
  });

  it('needs a policy when one is registered, and only that one', () => {
    // @ts-expect-error: a policy is registered, so every route gives one
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      handler: (c) => c.body(null, 200),
    });
    defineRoute({
      method: 'get',
      path: '/',
      description: 'Nothing',
      // @ts-expect-error: admin isn't the registered policy
      policy: 'admin',
      handler: (c) => c.body(null, 200),
    });
  });

  it('takes no policy when none is registered', () => {
    expectTypeOf<PolicyField<PolicyOf<{}>>>().toEqualTypeOf<{
      policy?: never;
    }>();

    const given: PolicyField<PolicyOf<{}>> = {
      // @ts-expect-error: with nothing registered, a route gives no policy
      policy: 'read',
    };

    void given;
  });
});
