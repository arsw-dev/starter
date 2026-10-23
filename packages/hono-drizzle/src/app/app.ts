import { database } from '#/db/db.ts';
import { notFound, onError } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';

import type { Binding, DB } from '#/db/db.ts';

type Options = {
  db?: Binding;
};

// An API's app, before its routes: the database on every request when it has
// one, then the not-found and error handlers
const createApp = <
  Variables extends object = {
    db: DB;
  },
>({ db }: Options = {}) => {
  const app = createRouter<Variables>();

  if (db) app.use(database(db));

  app.notFound(notFound);
  app.onError(onError);

  return app;
};

export { createApp };
