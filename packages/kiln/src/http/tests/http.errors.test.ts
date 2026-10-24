import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  Conflict,
  Forbidden,
  HttpError,
  NotFound,
  Unauthorized,
  onError,
  toErrorResponse,
} from '#/http/http.errors.ts';

it.each([
  ['Unauthorized', Unauthorized, 401],
  ['Forbidden', Forbidden, 403],
  ['NotFound', NotFound, 404],
  ['Conflict', Conflict, 409],
])('makes a %s a %i, with its message', (_, Kind, status) => {
  expect(toErrorResponse(new Kind('Todo not found'))).toEqual({
    status,
    body: {
      message: 'Todo not found',
    },
  });
});

it("answers an API's own HttpError with the status it declares", () => {
  class Gone extends HttpError {
    override name = 'Gone';
    readonly status = 410;
  }

  expect(toErrorResponse(new Gone('Todo was archived'))).toEqual({
    status: 410,
    body: {
      message: 'Todo was archived',
    },
  });
});

it('leaves a 422 to the validation hook, whose body has issues', () => {
  class Invalid extends HttpError {
    override name = 'Invalid';
    // @ts-expect-error: no HttpError can answer a 422 without its issues
    readonly status = 422;
  }

  void Invalid;
});

it("keeps an HTTPException's own status and message", () => {
  const err = new HTTPException(401, {
    message: 'Unauthorized',
  });

  expect(toErrorResponse(err)).toEqual({
    status: 401,
    body: {
      message: 'Unauthorized',
    },
  });
});

it('makes anything else a 500 that says nothing about it', () => {
  expect(toErrorResponse(new Error('the database password'))).toEqual({
    status: 500,
    body: {
      message: 'Internal Server Error',
    },
  });
});

describe('the log of a 500', () => {
  const app = new Hono()
    .post('/todos/:id', () => {
      throw new TypeError('the database password');
    })
    .get('/todos/:id', () => {
      throw new NotFound('Todo not found');
    })
    .onError(onError);

  // Everything a log must leave out: the body, who sent it, and the query
  const send = async (method: 'GET' | 'POST') =>
    app.request('/todos/1?email=ada@example.com', {
      method,
      headers: {
        authorization: 'Bearer secret',
        'cf-ray': '8f1e2d3c4b5a6978-LHR',
        'content-type': 'application/json',
        cookie: 'session=secret',
      },
      ...(method === 'POST'
        ? {
            body: JSON.stringify({
              title: 'Call Ada',
            }),
          }
        : {}),
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is one object: the error, the method, the path and the ray id', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await send('POST')).status).toBe(500);
    expect(log.mock.calls).toEqual([
      [
        {
          error: {
            name: 'TypeError',
            message: 'the database password',
            stack: expect.stringContaining('TypeError: the database password'),
          },
          method: 'POST',
          path: '/todos/1',
          rayId: '8f1e2d3c4b5a6978-LHR',
        },
      ],
    ]);
  });

  it('is written for a 500 only', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await send('GET')).status).toBe(404);
    expect(log).not.toHaveBeenCalled();
  });
});
