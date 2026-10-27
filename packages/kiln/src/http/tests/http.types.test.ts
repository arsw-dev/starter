import { createRoute, z } from '@hono/zod-openapi';
import { expectTypeOf, it } from 'vite-plus/test';

import { createMiddleware } from '#/http/http.middleware.ts';
import { createRouter } from '#/http/http.router.ts';
import { json } from '#/http/http.schemas.ts';

import type { Access, AppEnv } from '#/http/http.types.ts';
import type { DB } from '#/model/model.database.ts';

// The variables every test in this package's requests carry, and the access
// its routes may give, registered as an API registers its own: once, through
// the package's name. Augmentation is global, so this is the only registration
// the tests can have
declare module '@arsw/kiln' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- adding to Register needs declaration merging, which only an interface does
  interface Register {
    variables: {
      db: DB;
      greeting: string;
      user: string;
    };
    access: 'read' | 'write';
  }
}

it('gives every env the variables registered', () => {
  expectTypeOf<AppEnv['Variables']>().toEqualTypeOf<{
    db: DB;
    greeting: string;
    user: string;
  }>();
});

it('gives every route the access registered', () => {
  expectTypeOf<Access>().toEqualTypeOf<'read' | 'write'>();
});

it('types what a middleware sets, with no type arguments', () => {
  createMiddleware(async (c, next) => {
    c.set('user', 'Ada');

    // @ts-expect-error: user is registered as a string
    c.set('user', 1);

    // @ts-expect-error: nothing registered is called role
    c.set('role', 'admin');

    return next();
  });
});

it('types what a handler reads, with no type arguments', () => {
  createRouter().openapi(
    createRoute({
      method: 'get',
      path: '/',
      responses: {
        200: json(z.object({}), 'Nothing'),
      },
    }),
    (c) => {
      expectTypeOf(c.var.user).toEqualTypeOf<string>();
      expectTypeOf(c.var.db).toEqualTypeOf<DB>();

      // @ts-expect-error: nothing registered is called role
      void c.var.role;

      return c.json({}, 200);
    },
  );
});
