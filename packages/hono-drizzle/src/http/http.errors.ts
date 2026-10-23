import { HTTPException } from 'hono/http-exception';

import type { ErrorBody } from './http.types.ts';
import type { ErrorHandler, NotFoundHandler } from 'hono';

type ErrorResponse = {
  status: HTTPException['status'];
  body: ErrorBody;
};

class NotFound extends Error {
  override name = 'NotFound';
}

// What a thrown error becomes. Anything unexpected is a 500 that says nothing
// about it: the error itself is for the logs, never the client
const toErrorResponse = (err: Error): ErrorResponse => {
  if (err instanceof NotFound) {
    return {
      status: 404,
      body: {
        message: err.message,
      },
    };
  }

  if (err instanceof HTTPException) {
    return {
      status: err.status,
      body: {
        message: err.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      message: 'Internal Server Error',
    },
  };
};

const notFound: NotFoundHandler = (ctx) =>
  ctx.json(
    {
      message: 'Not Found',
    } satisfies ErrorBody,
    404,
  );

const onError: ErrorHandler = (err, ctx) => {
  const { status, body } = toErrorResponse(err);

  if (status === 500) console.error(err);

  return ctx.json(body, status);
};

export { NotFound, notFound, onError, toErrorResponse };
