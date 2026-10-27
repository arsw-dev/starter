import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vite-plus/test';

import { onError, toErrors } from '#/http/http.errors.ts';

import type { Declaration } from '#/http/http.errors.ts';
import type { TypedResponse } from 'hono';

describe('the errors a declaration gives', () => {
  // A route that answers whichever error its query names, with the message
  // its query gives, if any
  const app = new Hono().get('/', (c) => {
    const errors = toErrors(c, {
      notFound: 'Cannot find item',
      conflict: 'Item already exists',
      tooManyRequests: 'Slow down',
    });
    const name = c.req.query('name');
    const message = c.req.query('message');

    if (name === 'notFound') return errors.notFound(message);
    if (name === 'conflict') return errors.conflict(message);

    return errors.tooManyRequests(message);
  });

  const answer = async (query: string) => {
    const response = await app.request(`/?${query}`);

    return {
      status: response.status,
      body: await response.json(),
    };
  };

  it.each([
    ['notFound', 404, 'Cannot find item'],
    ['conflict', 409, 'Item already exists'],
    ['tooManyRequests', 429, 'Slow down'],
  ])(
    'answers %s with its status and the declared description',
    async (name, status, message) => {
      expect(await answer(`name=${name}`)).toEqual({
        status,
        body: {
          message,
        },
      });
    },
  );

  it('answers with the message given, over the description', async () => {
    expect(await answer('name=notFound&message=Todo+was+deleted')).toEqual({
      status: 404,
      body: {
        message: 'Todo was deleted',
      },
    });
  });

  it('gives nothing for a name that is no error', async () => {
    const names = new Hono().get('/', (c) =>
      c.json(
        Object.keys(
          toErrors(c, {
            notFound: 'Cannot find item',
            notAnError: 'Something',
          }),
        ),
      ),
    );

    expect(await (await names.request('/')).json()).toEqual(['notFound']);
  });
});

// What an app whose one route throws the error given answers
const answerThrown = async (err: Error) => {
  const response = await new Hono()
    .get('/', () => {
      throw err;
    })
    .onError(onError)
    .request('/');

  return {
    status: response.status,
    body: await response.json(),
  };
};

describe('what a thrown error answers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [400, 'Malformed JSON in request body'],
    [415, 'Unsupported Media Type'],
  ] as const)(
    "keeps the %i Hono and zod-openapi throw for a body, Kiln's own",
    async (status, message) => {
      expect(
        await answerThrown(
          new HTTPException(status, {
            message,
          }),
        ),
      ).toEqual({
        status,
        body: {
          message,
        },
      });
    },
  );

  it('makes anything else a 500 that says nothing about it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      await Promise.all([
        answerThrown(new Error('the database password')),
        answerThrown(
          new HTTPException(403, {
            message: 'the token was refused',
          }),
        ),
      ]),
    ).toEqual([
      {
        status: 500,
        body: {
          message: 'Internal Server Error',
        },
      },
      {
        status: 500,
        body: {
          message: 'Internal Server Error',
        },
      },
    ]);
  });
});

describe('the log of a 500', () => {
  const app = new Hono()
    .post('/todos/:id', () => {
      throw new TypeError('the database password');
    })
    .get('/todos/:id', () => {
      throw new HTTPException(400, {
        message: 'Malformed JSON in request body',
      });
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

    expect((await send('GET')).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });
});

// What a declaration's type says, which is the message in the editor: each
// name a type error that says what's wrong with it
describe("a declaration's type", () => {
  // A handler's return type: one 404, and a success
  type Answered =
    | TypedResponse<
        {
          message: string;
        },
        404,
        'json'
      >
    | TypedResponse<{}, 200, 'json'>;

  it('takes a name the handler returns', () => {
    expectTypeOf<
      Declaration<'notFound', Answered, never>['notFound']
    >().toEqualTypeOf<string>();
  });

  it('says a name is declared but never returned', () => {
    expectTypeOf<
      Declaration<'notFound' | 'conflict', Answered, never>['conflict']
    >().toEqualTypeOf<'conflict is declared but never returned'>();
    expectTypeOf<
      Declaration<'notFound', Promise<Answered | Response>, never>['notFound']
    >().toEqualTypeOf<string>();
  });

  it("says a name is Kiln's to answer, or no error's", () => {
    expectTypeOf<
      Declaration<
        'internalServerError',
        Answered,
        'internalServerError'
      >['internalServerError']
    >().toEqualTypeOf<'internalServerError is answered by Kiln'>();
    expectTypeOf<
      Declaration<'notAnError', Answered, never>['notAnError']
    >().toEqualTypeOf<"notAnError is not an error's name">();
  });
});
