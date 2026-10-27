/// <reference path="./kiln.d.ts" />

import { createApp } from '@arsw/kiln';
import { database } from '@arsw/kiln/model';

import { todosRoutes } from './todos/todos.routes.ts';

export default createApp({
  document: {
    title: 'Todos API',
    version: '1.0.0',
  },
  middleware: [database((env) => env.DB)],
  routes: {
    '/todos': todosRoutes,
  },
});
