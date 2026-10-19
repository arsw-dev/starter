import { HTTPException } from 'hono/http-exception';

import type { AppEnv } from './http.types.ts';
import type { ErrorHandler, NotFoundHandler } from 'hono';

class NotFound extends Error {
  override name = 'NotFound';
}

const notFound: NotFoundHandler<AppEnv> = (ctx) =>
  ctx.json(
    {
      message: 'Not Found',
    },
    404,
  );

const onError: ErrorHandler<AppEnv> = (err, ctx) => {
  if (err instanceof NotFound) {
    return ctx.json(
      {
        message: err.message,
      },
      404,
    );
  }

  if (err instanceof HTTPException) {
    return ctx.json(
      {
        message: err.message,
      },
      err.status,
    );
  }

  console.error(err);

  return ctx.json(
    {
      message: 'Internal Server Error',
    },
    500,
  );
};

export { NotFound, notFound, onError };
