import { database } from '#/db/db.ts';
import { notFound, onError } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';

import type { Binding, DB } from '#/db/db.ts';
import type { AppEnv } from '#/http/http.types.ts';
import type { MiddlewareHandler } from 'hono';

type Options<Variables extends object> = {
  db?: Binding;
  middleware?: MiddlewareHandler<AppEnv<Variables>>[];
};

// An API's app, before its routes: the database on every request when it has
// one, then its own middleware, in order, so each can use the database and
// what the ones before it set
const createApp = <
  Variables extends object = {
    db: DB;
  },
>({ db, middleware = [] }: Options<Variables> = {}) => {
  const app = createRouter<Variables>();

  if (db) app.use(database(db));

  // Hono takes a missing handler as a handler, so none means no call
  for (const handler of middleware) app.use(handler);

  app.notFound(notFound);
  app.onError(onError);

  return app;
};

export { createApp };
