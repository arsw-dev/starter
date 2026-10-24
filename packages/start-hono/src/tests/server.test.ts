import { createServerEntry } from '@tanstack/react-start/server';
import { Hono } from 'hono';
import { describe, expect, it } from 'vite-plus/test';

import { connect } from '#/server.ts';

import type { Client } from '#/server.ts';

// An API that answers with the headers its request arrived with
const api = new Hono().get('/headers', (c) =>
  c.json(Object.fromEntries(c.req.raw.headers)),
);

type Received = Record<string, string>;

const binding = () => ({
  fetch: async (request: Request) => api.fetch(request),
});

const getHeaders = async (client: Client<typeof api>) => client.headers.$get();

// What the API received from one call, made by a server function handling a
// request with these headers: Start's own entry gives the call the request
// scope a server function runs in
const received = async (
  call: ReturnType<typeof connect<typeof api>>,
  headers: HeadersInit,
  request = getHeaders,
) => {
  const { promise, resolve, reject } = Promise.withResolvers<Received>();

  const entry = createServerEntry({
    fetch: async () => {
      await call(request)({
        data: undefined,
      }).then(resolve, reject);

      return new Response();
    },
  });

  await entry.fetch(
    new Request('https://app.example/_serverFn/me', {
      headers,
    }),
  );

  return promise;
};

const incoming = {
  'x-user-token': 'eyJhbGciOiJSUzI1NiJ9',
  'x-tenant': 'acme',
  cookie: 'session=5f2b8c',
  authorization: 'Bearer 9c1d7e',
};

describe('forward', () => {
  it('sends each named header the incoming request has', async () => {
    const call = connect<typeof api>(binding, {
      name: 'test-api',
      forward: ['x-user-token', 'x-tenant'],
    });

    await expect(received(call, incoming)).resolves.toMatchObject({
      'x-user-token': 'eyJhbGciOiJSUzI1NiJ9',
      'x-tenant': 'acme',
    });
  });

  it('matches names whatever their case', async () => {
    const call = connect<typeof api>(binding, {
      name: 'test-api',
      forward: ['X-User-Token'],
    });

    await expect(received(call, incoming)).resolves.toMatchObject({
      'x-user-token': 'eyJhbGciOiJSUzI1NiJ9',
    });
  });

  it('sends none of the headers it isn’t given', async () => {
    const call = connect<typeof api>(binding, {
      name: 'test-api',
      forward: ['x-user-token'],
    });

    const headers = await received(call, incoming);

    expect(headers).not.toHaveProperty('cookie');
    expect(headers).not.toHaveProperty('authorization');
    expect(headers).not.toHaveProperty('x-tenant');
  });

  it('leaves out a named header the incoming request lacks', async () => {
    const call = connect<typeof api>(binding, {
      name: 'test-api',
      forward: ['x-user-token'],
    });

    await expect(
      received(call, {
        'x-tenant': 'acme',
      }),
    ).resolves.not.toHaveProperty('x-user-token');
  });

  it("lets a call's own header win over a forwarded one", async () => {
    const call = connect<typeof api>(binding, {
      name: 'test-api',
      forward: ['x-user-token', 'x-tenant'],
    });

    await expect(
      received(call, incoming, async (client) =>
        client.headers.$get(undefined, {
          headers: {
            'x-tenant': 'globex',
          },
        }),
      ),
    ).resolves.toMatchObject({
      'x-user-token': 'eyJhbGciOiJSUzI1NiJ9',
      'x-tenant': 'globex',
    });
  });
});

describe('without forward', () => {
  const call = connect<typeof api>(binding, {
    name: 'test-api',
  });

  it('sends none of the incoming headers', async () => {
    const headers = await received(call, incoming);

    for (const name of Object.keys(incoming)) {
      expect(headers).not.toHaveProperty(name);
    }
  });

  it('never reads the incoming request', async () => {
    await expect(
      call(getHeaders)({
        data: undefined,
      }),
    ).resolves.toEqual({});
  });
});
