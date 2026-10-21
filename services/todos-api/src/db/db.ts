import { drizzle } from 'drizzle-orm/d1';
import { createMiddleware } from 'hono/factory';

import { createDefineModel } from '#/model/model.factory.ts';

import type { AppEnv } from '#/http/http.types.ts';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// The one call that sets how every model in this API is stored
const defineModel = createDefineModel();

const database = createMiddleware<AppEnv>(async (c, next) => {
  c.set('db', drizzle(c.env.DB));

  await next();
});

type DB = DrizzleD1Database;

export { database, defineModel };
export type { DB };
