import { desc, eq } from 'drizzle-orm';

import { todosModel } from './todos.model.ts';

import type { DB } from '@arsw/kiln/model';
import type { z } from '@hono/zod-openapi';

// Each one returns what it found, or undefined for a todo that isn't there:
// which error that is, the route says
const todosOps = {
  get: async (db: DB, id: string) =>
    db
      .select(todosModel.readColumns)
      .from(todosModel.table)
      .where(eq(todosModel.table.id, id))
      .get(),
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
  ) =>
    db
      .update(todosModel.table)
      .set(updates)
      .where(eq(todosModel.table.id, id))
      .returning(todosModel.readColumns)
      .get(),
  delete: async (db: DB, id: string) =>
    db
      .delete(todosModel.table)
      .where(eq(todosModel.table.id, id))
      .returning({
        id: todosModel.table.id,
      })
      .get(),
};

export { todosOps };
