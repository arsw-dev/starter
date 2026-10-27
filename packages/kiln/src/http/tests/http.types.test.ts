import { describe, expectTypeOf, it } from 'vite-plus/test';

import { defineMiddleware } from '#/http/http.middleware.ts';
import { defineRoute } from '#/http/http.route.ts';

import type { AppEnv, Policy, PolicyOf } from '#/http/http.types.ts';
import type { DB } from '#/model/model.database.ts';

// The variables every test in this package's requests carry, and the policy
// its routes give, registered as an API registers its own: once, through the
// package's name. Augmentation is global, so this is the only registration the
// tests can have: every route and app in them gives a policy
declare module '@arsw/kiln' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- adding to Register needs declaration merging, which only an interface does
  interface Register {
    variables: {
      db: DB;
      greeting: string;
      user: string;
    };
    policy: 'read' | 'write';
  }
}

it('gives every env the variables registered', () => {
  expectTypeOf<AppEnv['Variables']>().toEqualTypeOf<{
    db: DB;
    greeting: string;
    user: string;
  }>();
});

it('gives every route the policy registered', () => {
  expectTypeOf<Policy>().toEqualTypeOf<'read' | 'write'>();
});

it('types what a middleware sets, with no type arguments', () => {
  defineMiddleware({
    handler: async (c, next) => {
      c.set('user', 'Ada');

      // @ts-expect-error: user is registered as a string
      c.set('user', 1);

      // @ts-expect-error: nothing registered is called role
      c.set('role', 'admin');

      return next();
    },
  });
});

it('types what a handler reads, with no type arguments', () => {
  defineRoute({
    method: 'get',
    path: '/',
    description: 'Nothing',
    policy: 'read',
    handler: (c) => {
      expectTypeOf(c.var.user).toEqualTypeOf<string>();
      expectTypeOf(c.var.db).toEqualTypeOf<DB>();

      // @ts-expect-error: nothing registered is called role
      void c.var.role;

      return c.body(null, 200);
    },
  });
});

describe('a registration', () => {
  it('gives no policy when it registers none', () => {
    expectTypeOf<PolicyOf<{}>>().toBeNever();
    expectTypeOf<
      PolicyOf<{
        variables: {};
      }>
    >().toBeNever();
  });

  it('takes a policy that is JSON', () => {
    type Rules = {
      guests: 'none' | 'read';
      limits: [number, null];
      note?: string;
      tiers: {
        free: boolean;
      }[];
    };

    expectTypeOf<
      PolicyOf<{
        policy: Rules;
      }>
    >().toEqualTypeOf<Rules>();
  });

  it('refuses a policy that is not JSON', () => {
    type OfDate = PolicyOf<{
      policy: Date;
    }>;
    type OfCheck = PolicyOf<{
      policy: {
        allow: () => boolean;
      };
    }>;
    type OfMaybe = PolicyOf<{
      policy: 'read' | undefined;
    }>;

    // @ts-expect-error: a Date isn't JSON
    const date: OfDate = new Date();
    const check: OfCheck = {
      // @ts-expect-error: nor is an object with a function in it
      allow: () => true,
    };
    // @ts-expect-error: nor a policy that may be undefined
    const maybe: OfMaybe = 'read';

    void [date, check, maybe];
  });
});
