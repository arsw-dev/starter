import { drizzle } from 'drizzle-orm/d1';
import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '#/http/http.types.ts';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// Where the app's D1 database is, among its bindings: (env) => env.DB
type Binding = (env: Cloudflare.Env) => D1Database;

type DB = DrizzleD1Database;

// A middleware like any other, first in createApp's list so the rest can use
// c.var.db. Generic, inferred from where it's used: a context's variables are
// read and set, so one typed with only { db } wouldn't fit beside a middleware
// that sets something else
const database = <
  Variables extends {
    db: DB;
  },
>(
  binding: Binding,
) =>
  createMiddleware<AppEnv<Variables>>(async (c, next) => {
    c.set('db', drizzle(binding(c.env)));

    await next();
  });

export { database };
export type { Binding, DB };
