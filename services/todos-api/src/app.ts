import { database } from './db/db.ts';
import { notFound, onError } from './http/http.errors.ts';
import { createRouter } from './http/http.router.ts';

const createApp = () => {
  const app = createRouter();

  app.use(database);

  app.notFound(notFound);
  app.onError(onError);

  return app;
};

export { createApp };
