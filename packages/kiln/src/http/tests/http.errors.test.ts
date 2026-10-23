import { HTTPException } from 'hono/http-exception';
import { expect, it } from 'vite-plus/test';

import {
  Conflict,
  Forbidden,
  HttpError,
  NotFound,
  Unauthorized,
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
