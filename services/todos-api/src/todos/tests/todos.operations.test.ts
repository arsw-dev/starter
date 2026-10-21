import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { todosModel } from '#/todos/todos.model.ts';
import { todosOps } from '#/todos/todos.operations.ts';

const db = drizzle(env.DB);

// Written straight to the table, with the creation time the test needs
const insert = async (title: string, at: string) =>
  db
    .insert(todosModel.table)
    .values({
      title,
      createdAt: at,
      updatedAt: at,
    })
    .returning(todosModel.readColumns)
    .get();

beforeEach(async () => {
  await db.delete(todosModel.table);
});

describe('getAll', () => {
  it('lists the newest first, and the later of two made at once', async () => {
    const oldest = await insert('Oldest', '2026-10-01T00:00:00.000Z');
    const first = await insert('First at noon', '2026-10-02T12:00:00.000Z');
    const second = await insert('Second at noon', '2026-10-02T12:00:00.000Z');

    expect(await todosOps.getAll(db)).toEqual([second, first, oldest]);
  });
});
