import { createRoute, z } from '@hono/zod-openapi';

import { json } from '#/http/http.schemas.ts';

import { todos } from './todos.model.ts';

const listTodos = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: json(z.array(todos.readSchema), 'Every todo'),
  },
});

type ListTodos = typeof listTodos;

export { listTodos };
export type { ListTodos };
