import { createRoute, z } from '@hono/zod-openapi';
import { hc } from 'hono/client';
import { expect, expectTypeOf, it } from 'vite-plus/test';

import { createRouter } from '#/http/http.router.ts';
import { errorSchema, errors, json } from '#/http/http.schemas.ts';

import type { InferResponseType } from 'hono/client';

const route = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: json(
      z.object({
        id: z.string(),
      }),
      'One item',
    ),
    ...errors({
      404: 'Cannot find item',
    }),
  },
});

it('makes each status an error body with its description', () => {
  expect(
    errors({
      404: 'Cannot find item',
      409: 'Item already exists',
    }),
  ).toEqual({
    404: json(errorSchema, 'Cannot find item'),
    409: json(errorSchema, 'Item already exists'),
  });
});

it('types a handler against the statuses it declares', () => {
  const router = createRouter().openapi(route, (c) =>
    c.json(
      {
        message: 'Cannot find item',
      },
      404,
    ),
  );
  const client = hc<typeof router>('http://localhost');

  expectTypeOf<
    InferResponseType<typeof client.index.$get, 404>
  >().toEqualTypeOf<{
    message: string;
  }>();

  createRouter().openapi(route, (c) =>
    // @ts-expect-error: 409 isn't one of the route's responses
    c.json(
      {
        message: 'Item already exists',
      },
      409,
    ),
  );
});
