import { todosRouter } from '#/todos/todos.router.ts';

import type { AppEnv } from '@arsw/hono-drizzle';
import type { OpenAPIHono } from '@hono/zod-openapi';

const registerRoutes = (app: OpenAPIHono<AppEnv>) =>
  app.route('/', todosRouter);

export { registerRoutes };
