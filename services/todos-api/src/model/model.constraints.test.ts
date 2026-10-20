import { z } from '@hono/zod-openapi';
import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vite-plus/test';

import {
  WHITESPACE_CODES,
  gt,
  gte,
  isBoolean,
  isDate,
  isInteger,
  isReal,
  isText,
  isTimestamp,
  isUuid,
  lt,
  lte,
  maxLength,
  notBlank,
  oneOf,
  trimmed,
} from './model.constraints.ts';
import { idSchema, timestampSchema } from './model.factory.ts';
import { field } from './model.fields.ts';

import type { Constraint } from './model.constraints.ts';

// How values cross between zod and the column: a boolean is 0 or 1 in the
// database. Decoding leaves anything else as it is, for zod to refuse
type Column = {
  affinity: string;
  encode?: (value: unknown) => unknown;
  decode?: (value: unknown) => unknown;
};

const dialect = new SQLiteSyncDialect();

// Writes a value into a column of its own, under the constraint's CHECK, and
// gives back what the database stored, or undefined if that CHECK refused it.
// Any other error throws, so a broken table can't pass as a refusal
const write = async (
  constraint: Pick<Constraint<z.ZodType>, 'name' | 'check'>,
  column: Column,
  value: unknown,
) => {
  const { sql: check } = dialect.sqlToQuery(
    constraint.check(sql.identifier('value')),
  );

  await env.DB.prepare('DROP TABLE IF EXISTS twin').run();
  await env.DB.prepare(
    `CREATE TABLE twin (value ${column.affinity}, CONSTRAINT "value_${constraint.name}" CHECK (${check}))`,
  ).run();

  try {
    const row = await env.DB.prepare(
      'INSERT INTO twin (value) VALUES (?) RETURNING value',
    )
      .bind(column.encode ? column.encode(value) : value)
      .first<{
        value: unknown;
      }>();

    return {
      value: column.decode ? column.decode(row?.value) : row?.value,
    };
  } catch (err) {
    if (
      String(err).includes(`CHECK constraint failed: value_${constraint.name}`)
    ) {
      return undefined;
    }

    throw err;
  }
};

// The twin claim, one value at a time. Whatever zod outputs, the database
// stores; whatever the database stores, even written raw (as a write that
// bypasses the API would), zod accepts unchanged
const twins = <TSchema extends z.ZodType>(
  constraint: Constraint<TSchema>,
  base: TSchema,
  column: Column,
  cases: [value: unknown, valid: boolean][],
) =>
  it.each(cases)('%j: %s', async (value, valid) => {
    const schema = constraint.rule(base, 'Value');
    const result = schema.safeParse(value);

    expect(result.success).toBe(valid);

    if (result.success) {
      expect(await write(constraint, column, result.data)).toBeDefined();
    }

    const stored = await write(constraint, column, value);

    if (stored) expect(schema.parse(stored.value)).toEqual(stored.value);
  });

const TEXT = {
  affinity: 'TEXT',
};

const INTEGER = {
  affinity: 'INTEGER',
};

const REAL = {
  affinity: 'REAL',
};

const NO_ACCESS = {
  access: [],
};

// The type constraints' zod side is the field kind's own schema, so these
// tests check the base the factory uses
const base = {
  text: field
    .text({
      trim: false,
      access: [],
    })
    .schema('Value'),
  integer: field
    .number({
      type: 'integer',
      access: [],
    })
    .schema('Value'),
  real: field
    .number({
      type: 'real',
      access: [],
    })
    .schema('Value'),
  boolean: field.boolean(NO_ACCESS).schema('Value'),
  date: field.date(NO_ACCESS).schema('Value'),
};

const blob = new Uint8Array([104, 105]).buffer;

describe('isText', () => {
  twins(isText, base.text, TEXT, [
    ['hi', true],
    ['', true],
    [blob, false],
    [5, false],
  ]);
});

describe('trimmed', () => {
  twins(trimmed, z.string(), TEXT, [
    ['hi', true],
    ['hi there', true],
    ['  hi  ', true],
    ['\thi\n', true],
    [' hi　', true],
    ['﻿hi', true],
  ]);

  it('lists exactly the characters String.prototype.trim() strips', () => {
    const stripped = Array.from(
      {
        length: 0x10000,
      },
      (_, code) => code,
    ).filter((code) => String.fromCharCode(code).trim() === '');

    expect(WHITESPACE_CODES).toEqual(stripped);
  });
});

describe('notBlank', () => {
  twins(notBlank, z.string(), TEXT, [
    ['a', true],
    [' ', true],
    ['', false],
  ]);

  it('says which field is blank', () => {
    const result = notBlank.rule(z.string(), 'Title').safeParse('');

    expect(result.error?.issues[0]?.message).toBe("Title can't be blank");
  });
});

describe('maxLength', () => {
  twins(maxLength(3), z.string(), TEXT, [
    ['abc', true],
    ['abcd', false],
    ['😀😀😀', true],
    ['😀😀😀😀', false],
    ['', true],
  ]);

  it('says which field is too long, and by what limit', () => {
    const result = maxLength(3).rule(z.string(), 'Title').safeParse('abcd');

    expect(result.error?.issues[0]?.message).toBe(
      "Title can't be longer than 3 characters",
    );
  });
});

describe('isInteger', () => {
  twins(isInteger, base.integer, INTEGER, [
    [5, true],
    [0, true],
    [-3, true],
    [1.5, false],
    ['abc', false],
    ['7', false],
    [2 ** 53, false],
  ]);
});

describe('isReal', () => {
  twins(isReal, base.real, REAL, [
    [1.5, true],
    [5, true],
    [-0.25, true],
    ['abc', false],
    [Infinity, false],
  ]);
});

// Numbers only: a bound alone lets text through, which the type check refuses
describe('bounds', () => {
  twins(gt(0), z.number(), REAL, [
    [0.5, true],
    [0, false],
    [-1, false],
  ]);

  twins(gte(1), z.int(), INTEGER, [
    [1, true],
    [2, true],
    [0, false],
  ]);

  twins(lt(10), z.number(), REAL, [
    [9.5, true],
    [10, false],
  ]);

  twins(lte(5), z.int(), INTEGER, [
    [5, true],
    [6, false],
  ]);

  it('says which field is out of bounds, and which bound', () => {
    const result = gte(1).rule(z.int(), 'Estimate').safeParse(0);

    expect(result.error?.issues[0]?.message).toBe(
      'Estimate must be at least 1',
    );
  });
});

describe('isBoolean', () => {
  twins(
    isBoolean,
    base.boolean,
    {
      affinity: 'INTEGER',
      encode: (value) => (typeof value === 'boolean' ? Number(value) : value),
      decode: (value) => (value === 0 || value === 1 ? value === 1 : value),
    },
    [
      [true, true],
      [false, true],
      [1, false],
      [2, false],
      ['yes', false],
    ],
  );
});

describe('oneOf', () => {
  const values = ['low', 'medium', "won't"] as const;

  twins(oneOf(values), field.enum(values, NO_ACCESS).schema('Value'), TEXT, [
    ['low', true],
    ["won't", true],
    ['LOW', false],
    ['urgent', false],
  ]);
});

describe('isDate', () => {
  twins(isDate, base.date, TEXT, [
    ['2026-01-05', true],
    ['2024-02-29', true],
    ['2026-1-5', false],
    ['2026-02-30', false],
    ['2025-02-29', false],
    [20260105, false],
  ]);
});

describe('isTimestamp', () => {
  twins(isTimestamp, timestampSchema, TEXT, [
    ['2026-10-19T12:00:00.000Z', true],
    ['2026-10-19T12:00:00Z', false],
    ['2026-10-19T12:00:00.000+01:00', false],
    ['2026-13-01T00:00:00.000Z', false],
  ]);
});

describe('isUuid', () => {
  const uuid = crypto.randomUUID();

  twins(isUuid, idSchema, TEXT, [
    [uuid, true],
    [uuid.toUpperCase(), true],
    ['01890a5d-ac96-774b-bcce-b302099a8057', false],
    ['not-a-uuid', false],
    [new TextEncoder().encode(uuid).buffer, false],
  ]);
});
