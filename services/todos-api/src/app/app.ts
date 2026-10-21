import { database } from '#/db/db.ts';
import { notFound, onError } from '#/http/http.errors.ts';
import { createRouter } from '#/http/http.router.ts';
import { todosRouter } from '#/todos/todos.router.ts';

import type { AppEnv } from '#/http/http.types.ts';
import type { OpenAPIHono } from '@hono/zod-openapi';

const registerRoutes = (app: OpenAPIHono<AppEnv>) =>
  app.route('/', todosRouter);

const createApp = () => {
  const app = createRouter();

  app.use(database);

  app.notFound(notFound);
  app.onError(onError);

  return app;
};

export { createApp, registerRoutes };
