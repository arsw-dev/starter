import { createApp } from '@arsw/kiln';
import { database } from '@arsw/kiln/model';

import { todosRoutes } from './todos/todos.routes.ts';

import type { DB } from '@arsw/kiln/model';

// What every request carries, for every router and middleware: the database,
// which the first middleware sets. Here, beside the app, so any program with
// the app's type, a front end's among them, has it too
declare module '@arsw/kiln' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- adding to Register needs declaration merging, which only an interface does
  interface Register {
    variables: {
      db: DB;
    };
  }
}

export default createApp({
  middleware: [database((env) => env.DB)],
  routes: {
    '/todos': todosRoutes,
  },
});
