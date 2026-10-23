import { createApp } from '@arsw/hono-drizzle';

import { todosRouter } from './todos/todos.router.ts';

export default createApp({
  db: (env) => env.DB,
  routes: {
    '/': todosRouter,
  },
});
