import { database } from '#/db/db.ts';
import { notFound, onError } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';

import type { Binding } from '#/db/db.ts';

type Options = {
  db: Binding;
};

// An API's app, before its routes: the database on every request, then the
// not-found and error handlers
const createApp = ({ db }: Options) => {
  const app = createRouter();

  app.use(database(db));

  app.notFound(notFound);
  app.onError(onError);

  return app;
};

export { createApp };
