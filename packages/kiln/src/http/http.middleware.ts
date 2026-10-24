import { createFactory } from 'hono/factory';

import type { AppEnv, ErrorDescriptions } from './http.types.ts';
import type { MiddlewareHandler } from 'hono';

// Hono's createMiddleware, typed by the API's registered variables, so a
// middleware reads and sets them with no type arguments
const { createMiddleware } = createFactory<AppEnv>();

// A middleware and the errors it answers with, which createApp adds to every
// route it runs before. Not the 500, which is onError's
type Middleware = {
  handler: MiddlewareHandler<AppEnv>;
  errors: Omit<ErrorDescriptions, 500>;
};

const defineMiddleware = (
  handler: MiddlewareHandler<AppEnv>,
  {
    errors,
  }: {
    errors: Middleware['errors'];
  },
): Middleware => ({
  handler,
  errors,
});

export { createMiddleware, defineMiddleware };
export type { Middleware };
