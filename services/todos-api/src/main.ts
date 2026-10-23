import { createApp } from '@arsw/kiln';
import { database } from '@arsw/kiln/model';

import { todosRouter } from './todos/todos.router.ts';

export default createApp({
  middleware: [database((env) => env.DB)],
  routes: {
    '/': todosRouter,
  },
});
