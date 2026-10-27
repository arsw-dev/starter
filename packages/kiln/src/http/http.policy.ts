import { toAnswer, toErrors } from './http.errors.ts';

import type {
  Declaration,
  ErrorDescriptions,
  ErrorName,
  ErrorResponse,
  Errors,
  KilnErrorName,
  StatusOf,
} from './http.errors.ts';
import type { AppEnv, Policy } from './http.types.ts';
import type { Context, MiddlewareHandler } from 'hono';

// What enforce may return: nothing, which lets the route run, or one of its
// errors, which refuses the caller
type EnforceResponse<Names extends string> =
  | void
  | ErrorResponse<StatusOf<Names>>
  | Promise<void | ErrorResponse<StatusOf<Names>>>;

// createApp's policy, written inline: its errors, by name, and enforce, which
// gets each route's own policy and a function for each error. Inline, so
// createApp types enforce from the errors, and checks each is returned
type PolicyOptions<
  Given,
  Names extends string,
  Return extends EnforceResponse<Names>,
> = {
  errors?: Declaration<Names, Return, KilnErrorName>;
  enforce: (c: Context<AppEnv>, policy: Given, errors: Errors<Names>) => Return;
};

// createApp's policy, with a policy registered and only then, given or not
type PolicyOption<
  Given,
  Names extends string,
  Return extends EnforceResponse<Names>,
> = [Given] extends [never]
  ? {
      policy?: never;
    }
  : {
      policy: PolicyOptions<Given, Names, Return>;
    };

// A policy as definePolicy gives it: its errors, by name, and enforce, typed
// as checked, so createApp reads both again without checking them twice
type AppPolicy<
  Names extends string = never,
  Return extends EnforceResponse<Names> = EnforceResponse<Names>,
> = {
  errors: Record<Names, string>;
  enforce: (
    c: Context<AppEnv>,
    policy: Policy,
    errors: Errors<Names>,
  ) => Return;
};

// createApp's policy, written in a file of its own: the same object as inline,
// and the same checks. A function only so enforce is typed from the errors,
// and its errors checked against what it returns
const definePolicy = <
  Names extends string = never,
  Return extends EnforceResponse<Names> = EnforceResponse<Names>,
>({
  errors,
  enforce,
}: PolicyOptions<Policy, Names, Return>): AppPolicy<Names, Return> => ({
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the declaration, which its type checked: a description for each name
  errors: (errors ?? {}) as Record<Names, string>,
  enforce,
});

// The policy as createApp keeps it, whatever errors it names
type AnyPolicy = {
  errors?: ErrorDescriptions;
  enforce: (
    c: Context<AppEnv>,
    policy: Policy,
    errors: Errors<ErrorName>,
  ) => EnforceResponse<ErrorName>;
};

// enforce for one route, as the middleware zod-openapi runs before the route's
// validators, so a refused caller never learns the route's schema
const toPolicyMiddleware =
  (
    { errors = {}, enforce }: AnyPolicy,
    policy: Policy,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const refusal = toAnswer(await enforce(c, policy, toErrors(c, errors)));

    return refusal ?? next();
  };

export { definePolicy, toPolicyMiddleware };
export type { AnyPolicy, AppPolicy, EnforceResponse, PolicyOption };
