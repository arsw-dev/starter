import { env } from 'cloudflare:workers';
import { SQLiteSyncDialect, getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { createDefineModel } from './model.factory.ts';
import { enumOf, field } from './model.fields.ts';

import type { z } from '@hono/zod-openapi';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

const defineModel = createDefineModel();

const PRIORITIES = enumOf(['low', 'medium', 'high']);

const EVERYONE = ['read', 'create', 'update'] as const;

const todos = defineModel('todos', {
  title: field.text({
    notBlank: true,
    maxLength: 200,
    access: EVERYONE,
  }),
  done: field.boolean({
    default: false,
    access: ['read', 'update'],
  }),
  priority: field.enum(PRIORITIES, {
    default: 'medium',
    access: EVERYONE,
  }),
  estimate: field.number({
    type: 'integer',
    gte: 1,
    optional: true,
    access: EVERYONE,
  }),
  dueDate: field.date({
    optional: true,
    access: EVERYONE,
  }),
  secret: field.text({
    access: [],
  }),
});

const dialect = new SQLiteSyncDialect();

const checksOf = (table: SQLiteTable) =>
  getTableConfig(table).checks.map((c) => ({
    name: c.name,
    sql: dialect.sqlToQuery(c.value).sql,
  }));

// Whether a CHECK lets a value through, by SQLite's rule: only false refuses
const passes = async (checkSql: string, column: string, value: unknown) => {
  const row = await env.DB.prepare(
    `SELECT (${checkSql}) AS ok FROM (SELECT ? AS "${column}")`,
  )
    .bind(value)
    .first<{
      ok: number | null;
    }>();

  return row?.ok !== 0;
};

describe('types', () => {
  it('types the table as Drizzle would', () => {
    expectTypeOf<typeof todos.table.$inferSelect>().toEqualTypeOf<{
      pk: number;
      id: string;
      title: string;
      done: boolean;
      priority: 'low' | 'medium' | 'high';
      estimate: number | null;
      dueDate: string | null;
      secret: string;
      createdAt: string;
      updatedAt: string;
    }>();

    expectTypeOf<typeof todos.table.$inferInsert>().toEqualTypeOf<{
      pk?: number | undefined;
      id?: string | undefined;
      title: string;
      done?: boolean | undefined;
      priority?: 'low' | 'medium' | 'high' | undefined;
      estimate?: number | null | undefined;
      dueDate?: string | null | undefined;
      secret: string;
      createdAt?: string | undefined;
      updatedAt?: string | undefined;
    }>();
  });

  it('types each schema from access, optional and default', () => {
    expectTypeOf<z.infer<typeof todos.select>>().toEqualTypeOf<{
      id: string;
      title: string;
      done: boolean;
      priority: 'low' | 'medium' | 'high';
      estimate: number | null;
      dueDate: string | null;
      createdAt: string;
      updatedAt: string;
    }>();

    expectTypeOf<z.infer<typeof todos.create>>().toEqualTypeOf<{
      title: string;
      priority?: 'low' | 'medium' | 'high' | undefined;
      estimate?: number | null | undefined;
      dueDate?: string | null | undefined;
    }>();

    expectTypeOf<z.infer<typeof todos.update>>().toEqualTypeOf<{
      title?: string | undefined;
      done?: boolean | undefined;
      priority?: 'low' | 'medium' | 'high' | undefined;
      estimate?: number | null | undefined;
      dueDate?: string | null | undefined;
    }>();
  });

  it('refuses a field named like a standard column', () => {
    defineModel('clash', {
      // @ts-expect-error: every model has its own id
      id: field.text({
        access: [],
      }),
    });
  });
});

describe('the table', () => {
  it('names each check by its column, in snake case', () => {
    expect(checksOf(todos.table).map((c) => c.name)).toEqual([
      'id_is_uuid',
      'title_is_text',
      'title_is_trimmed',
      'title_not_blank',
      'title_max_length',
      'done_is_boolean',
      'priority_is_in_enum',
      'estimate_is_integer',
      'estimate_at_least',
      'due_date_is_date',
      'secret_is_text',
      'secret_is_trimmed',
      'created_at_is_timestamp',
      'updated_at_is_timestamp',
    ]);
  });

  it("lets NULL through an optional field's checks, and nothing else", async () => {
    const estimate = checksOf(todos.table).filter((c) =>
      c.name.startsWith('estimate_'),
    );

    const results = await Promise.all(
      estimate.map(async (c) => [
        c.name,
        await passes(c.sql, 'estimate', null),
        await passes(c.sql, 'estimate', 'abc'),
      ]),
    );

    expect(results).toEqual([
      ['estimate_is_integer', true, false],
      ['estimate_at_least', true, true],
    ]);

    const isText = checksOf(todos.table).find(
      (c) => c.name === 'title_is_text',
    );

    expect(await passes(isText?.sql ?? '', 'title', null)).toBe(false);
  });

  it('makes only optional fields nullable', () => {
    const notNull = Object.fromEntries(
      getTableConfig(todos.table).columns.map((c) => [c.name, c.notNull]),
    );

    expect(notNull).toMatchObject({
      title: true,
      estimate: false,
      due_date: false,
      created_at: true,
    });
  });

  it('keeps the keys as column names when told to', () => {
    const model = createDefineModel({
      casing: 'camelCase',
    })('notes', {
      dueDate: field.date({
        access: [],
      }),
    });

    expect(model.table.dueDate.name).toBe('dueDate');
    expect(model.table.createdAt.name).toBe('createdAt');
  });

  it("refuses a default its field's constraints would refuse or change", () => {
    expect(() =>
      defineModel('notes', {
        title: field.text({
          notBlank: true,
          default: '',
          access: [],
        }),
      }),
    ).toThrow("title's default breaks its own constraints");

    expect(() =>
      defineModel('notes', {
        title: field.text({
          default: ' untitled',
          access: [],
        }),
      }),
    ).toThrow("title's default breaks its own constraints");
  });
});

describe('the schemas', () => {
  it('labels messages from the key', () => {
    const result = todos.create.safeParse({
      title: 'Write it',
      dueDate: 'tomorrow',
    });

    expect(result.error?.issues[0]?.message).toBe(
      'Due date must be a date in YYYY-MM-DD format',
    );
  });

  it('refuses an empty update, and keys no field takes', () => {
    expect(todos.update.safeParse({}).error?.issues[0]?.message).toBe(
      'Send at least one field to update',
    );
    expect(
      todos.create.safeParse({
        title: 'Write it',
        done: true,
      }).success,
    ).toBe(false);
  });

  it('parses an update to exactly what was sent, with no defaults', () => {
    expect(
      todos.update.parse({
        title: ' Ship it ',
      }),
    ).toEqual({
      title: 'Ship it',
    });
  });

  it('takes an id in any case and gives it back lowercase', () => {
    const id = crypto.randomUUID();

    expect(
      todos.params.parse({
        id: id.toUpperCase(),
      }),
    ).toEqual({
      id,
    });
    expect(
      todos.params.safeParse({
        id: 'not-a-uuid',
      }).error?.issues[0]?.message,
    ).toBe('Id must be a uuid');
  });
});
