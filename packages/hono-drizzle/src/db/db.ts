import { drizzle } from 'drizzle-orm/d1';
import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '#/http/http.types.ts';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// Where the app's D1 database is, among its bindings: (env) => env.DB
type Binding = (env: Cloudflare.Env) => D1Database;

type DB = DrizzleD1Database;

const database = (binding: Binding) =>
  createMiddleware<AppEnv>(async (c, next) => {
    c.set('db', drizzle(binding(c.env)));

    await next();
  });

export { database };
export type { Binding, DB };
