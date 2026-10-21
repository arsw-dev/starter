import { desc } from 'drizzle-orm';

import { todos } from './todos.model.ts';

import type { AppRouteHandler } from '#/http/http.types.ts';
import type { ListTodos } from './todos.routes.ts';

const listTodosHandler: AppRouteHandler<ListTodos> = async (c) => {
  const rows = await c.var.db
    .select(todos.readColumns)
    .from(todos.table)
    .orderBy(desc(todos.table.createdAt), desc(todos.table.pk))
    .all();

  return c.json(rows, 200);
};

export { listTodosHandler };
