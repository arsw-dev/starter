import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vite-plus/test';

import app from '#/main.ts';

// A todo no test made: the table is empty unless one does
const missing = `/todos/${crypto.randomUUID()}`;

const answer = async (method: string, body?: unknown) => {
  const response = await app.request(
    missing,
    {
      method,
      headers: {
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

  return {
    status: response.status,
    body: await response.json(),
  };
};

describe('a todo that is not there', () => {
  it.each([
    ['GET', undefined],
    [
      'PATCH',
      {
        done: true,
      },
    ],
    ['DELETE', undefined],
  ])('is a 404 to %s', async (method, body) => {
    expect(await answer(method, body)).toEqual({
      status: 404,
      body: {
        message: 'Cannot find todo',
      },
    });
  });
});
