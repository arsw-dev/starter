import { desc, eq } from 'drizzle-orm';

import { NotFound } from '@arsw/hono-drizzle';

import { todosModel } from './todos.model.ts';

import type { DB } from '@arsw/hono-drizzle';
import type { z } from '@hono/zod-openapi';

const todosOps = {
  get: async (db: DB, id: string) => {
    const todo = await db
      .select(todosModel.readColumns)
      .from(todosModel.table)
      .where(eq(todosModel.table.id, id))
      .get();

    if (!todo) throw new NotFound('Todo not found');

    return todo;
  },
  getAll: async (db: DB) =>
    db
      .select(todosModel.readColumns)
      .from(todosModel.table)
      .orderBy(desc(todosModel.table.createdAt), desc(todosModel.table.pk)),
  create: async (db: DB, todo: z.infer<typeof todosModel.createSchema>) =>
    db
      .insert(todosModel.table)
      .values(todo)
      .returning(todosModel.readColumns)
      .get(),
  update: async (
    db: DB,
    id: string,
    updates: z.infer<typeof todosModel.updateSchema>,
  ) => {
    const updatedTodo = await db
      .update(todosModel.table)
      .set(updates)
      .where(eq(todosModel.table.id, id))
      .returning(todosModel.readColumns)
      .get();

    if (!updatedTodo) throw new NotFound('Todo not found');

    return updatedTodo;
  },
  delete: async (db: DB, id: string) => {
    const deletedTodo = await db
      .delete(todosModel.table)
      .where(eq(todosModel.table.id, id))
      .returning({
        id: todosModel.table.id,
      })
      .get();

    if (!deletedTodo) throw new NotFound('Todo not found');
  },
};

export { todosOps };
