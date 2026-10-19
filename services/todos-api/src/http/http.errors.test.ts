import { HTTPException } from 'hono/http-exception';
import { expect, it } from 'vite-plus/test';

import { NotFound, toErrorResponse } from './http.errors.ts';

it('makes a NotFound a 404 with its message', () => {
  expect(toErrorResponse(new NotFound('Todo not found'))).toEqual({
    status: 404,
    body: {
      message: 'Todo not found',
    },
  });
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
