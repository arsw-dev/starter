import { drizzle } from 'drizzle-orm/d1';
import { createMiddleware } from 'hono/factory';

import type { EnvWith } from '#/http/http.types.ts';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// Where the app's D1 database is, among its bindings: (env) => env.DB
type Binding = (env: Cloudflare.Env) => D1Database;

type DB = DrizzleD1Database;

// A middleware like any other, first in createApp's list so the rest can use
// c.var.db. Generic, inferred from where it's used: Kiln can't read the
// variables an API registers, but createApp's list gives them, and refuses
// them unless they have db
const database = <
  Variables extends {
    db: DB;
  },
>(
  binding: Binding,
) =>
  createMiddleware<EnvWith<Variables>>(async (c, next) => {
    c.set('db', drizzle(binding(c.env)));

    await next();
  });

export { database };
export type { Binding, DB };
