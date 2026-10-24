import { HTTPException } from 'hono/http-exception';

import type { ErrorBody, ErrorStatus } from './http.types.ts';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';

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

// A 500 as one object, so Workers Logs can filter on each field: the error,
// spelled out since an Error inside an object logs as {}, and where it
// happened. The path without its query, and nothing of the body or who sent
// it: a log must not carry personal data
const toErrorLog = (err: Error, ctx: Context) => ({
  error: {
    name: err.name,
    message: err.message,
    stack: err.stack,
  },
  method: ctx.req.method,
  path: ctx.req.path,
  rayId: ctx.req.header('cf-ray'),
});

const onError: ErrorHandler = (err, ctx) => {
  const { status, body } = toErrorResponse(err);

  if (status === 500) console.error(toErrorLog(err, ctx));

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
