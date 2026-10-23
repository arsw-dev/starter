import { HTTPException } from 'hono/http-exception';

import type { ErrorBody, ErrorStatus } from './http.types.ts';
import type { ErrorHandler, NotFoundHandler } from 'hono';

type ErrorResponse = {
  status: HTTPException['status'];
  body: ErrorBody;
};

// An error a handler or an operation throws on purpose, answered with its own
// status and message. Each kind says its status once, as a field, so an API
// adds one with a class of its own: class Gone extends HttpError { … = 410 }
abstract class HttpError extends Error {
  abstract readonly status: ErrorStatus;
}

class Unauthorized extends HttpError {
  override name = 'Unauthorized';
  readonly status = 401;
}

class Forbidden extends HttpError {
  override name = 'Forbidden';
  readonly status = 403;
}

class NotFound extends HttpError {
  override name = 'NotFound';
  readonly status = 404;
}

class Conflict extends HttpError {
  override name = 'Conflict';
  readonly status = 409;
}

// What a thrown error becomes. Anything unexpected is a 500 that says nothing
// about it: the error itself is for the logs, never the client
const toErrorResponse = (err: Error): ErrorResponse => {
  if (err instanceof HttpError || err instanceof HTTPException) {
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

export {
  Conflict,
  Forbidden,
  HttpError,
  NotFound,
  Unauthorized,
  notFound,
  onError,
  toErrorResponse,
};
