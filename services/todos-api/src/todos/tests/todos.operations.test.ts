import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
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

describe('update', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('completes a todo made done today, and keeps the day it was done', async () => {
    const todo = await insert('Ship it', '2026-10-01T00:00:00.000Z');
    const done = await todosOps.update(db, todo?.id ?? '', {
      done: true,
    });

    await db
      .update(todosModel.table)
      .set({
        completedOn: '2026-10-02',
      })
      .where(eq(todosModel.table.id, todo?.id ?? ''));

    const again = await todosOps.update(db, todo?.id ?? '', {
      done: true,
    });
    const renamed = await todosOps.update(db, todo?.id ?? '', {
      title: 'Ship it now',
    });

    expect([
      done?.completedOn,
      again?.completedOn,
      renamed?.completedOn,
    ]).toEqual([today, '2026-10-02', '2026-10-02']);
  });

  it('clears the day a todo made not done was completed', async () => {
    const todo = await insert('Ship it', '2026-10-01T00:00:00.000Z');

    await todosOps.update(db, todo?.id ?? '', {
      done: true,
    });

    const undone = await todosOps.update(db, todo?.id ?? '', {
      done: false,
    });

    expect(undone).toMatchObject({
      done: false,
      completedOn: null,
    });
  });
});
