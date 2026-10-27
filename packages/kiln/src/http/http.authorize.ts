import type { Access, AppEnv, ErrorDescriptions } from './http.types.ts';
import type { Context, MiddlewareHandler } from 'hono';

// Whether a caller may call a route, given the route's access, or undefined
// for a route that gives none. It refuses by throwing an HttpError
type Check = (
  c: Context<AppEnv>,
  access: Access | undefined,
) => void | Promise<void>;

// The check and the errors it throws, which createApp adds to every route it
// runs before. Not the 500, which is onError's
type Authorize = {
  check: Check;
  errors: Omit<ErrorDescriptions, 500>;
};

const defineAuthorize = (
  check: Check,
  {
    errors,
  }: {
    errors: Authorize['errors'];
  },
): Authorize => ({
  check,
  errors,
});

// The check for one route, as the middleware zod-openapi runs before the
// route's validators, so a refused caller never learns the route's schema
const toAuthorizeMiddleware =
  (
    { check }: Authorize,
    access: Access | undefined,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    await check(c, access);

    return next();
  };

export { defineAuthorize, toAuthorizeMiddleware };
export type { Authorize };
