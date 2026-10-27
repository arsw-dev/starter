import { toAnswer, toErrors } from './http.errors.ts';

import type {
  Declaration,
  ErrorDescriptions,
  ErrorResponse,
  Errors,
  KilnErrorName,
  StatusOf,
} from './http.errors.ts';
import type { AppEnv } from './http.types.ts';
import type { Context, MiddlewareHandler, Next } from 'hono';

// What a middleware's handler may return: what next() does, nothing, or one of
// its errors, which ends the request there
type MiddlewareResponse<Names extends string> =
  | void
  | ErrorResponse<StatusOf<Names>>
  | Promise<void | ErrorResponse<StatusOf<Names>>>;

// A middleware and the errors it answers with, which createApp adds to every
// route it runs before. Kiln's 422 and 500 aren't a middleware's
type Middleware = {
  handler: MiddlewareHandler<AppEnv>;
  errors: ErrorDescriptions;
};

// A middleware as one object: its errors, by name, and its handler, given a
// function for each of them as its last argument. A function only so the
// handler is typed from the errors, and its errors checked against what it
// returns
const defineMiddleware = <
  Names extends string = never,
  Return extends MiddlewareResponse<Names> = MiddlewareResponse<Names>,
>({
  errors,
  handler,
}: {
  errors?: Declaration<Names, Return, KilnErrorName>;
  handler: (c: Context<AppEnv>, next: Next, errors: Errors<Names>) => Return;
}): Middleware => ({
  errors: errors ?? {},
  handler: async (c, next) => {
    const answered = await handler(c, next, toErrors(c, errors ?? {}));

    return toAnswer(answered);
  },
});

export { defineMiddleware };
export type { Middleware };
