import { sql } from 'drizzle-orm';

import type { z } from '@hono/zod-openapi';
import type { SQL, SQLWrapper } from 'drizzle-orm';

// One rule a column's values keep, in both of its forms: a CHECK, so a write
// that bypasses the API can't break it, and a zod rule, so the API refuses it
// with a 422 before the database would with a 500. `name` ends the CHECK's
// name (`title_max_length`), and `label` starts a message ('Title')
type Constraint<TSchema extends z.ZodType> = {
  name: string;
  check: (column: SQLWrapper) => SQL;
  rule: (schema: TSchema, label: string) => TSchema;
};

// The characters String.prototype.trim() strips, so the database and zod
// agree on what a trimmed value is
const WHITESPACE_CODES = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198,
  8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
];

const WHITESPACE = sql.raw(`char(${WHITESPACE_CODES.join(', ')})`);

// A TEXT column stores a blob as a blob: only typeof() refuses one
const isText: Constraint<z.ZodString> = {
  name: 'is_text',
  check: (column) => sql`typeof(${column}) = 'text'`,
  rule: (schema) => schema,
};

const trimmed: Constraint<z.ZodString> = {
  name: 'is_trimmed',
  check: (column) => sql`${column} = trim(${column}, ${WHITESPACE})`,
  rule: (schema) => schema.trim(),
};

const notBlank: Constraint<z.ZodString> = {
  name: 'not_blank',
  check: (column) => sql`length(${column}) > 0`,
  rule: (schema, label) => schema.min(1, `${label} can't be blank`),
};

// SQLite's length() counts code points, zod's max() UTF-16 units (an emoji is
// two), so the rule counts code points too. JSON Schema's maxLength counts
// code points, so the document still says it
const maxLength = (max: number): Constraint<z.ZodString> => ({
  name: 'max_length',
  check: (column) => sql`length(${column}) <= ${sql.raw(String(max))}`,
  rule: (schema, label) =>
    schema
      .refine(
        (value) => Array.from(value).length <= max,
        `${label} can't be longer than ${max} characters`,
      )
      .openapi({
        maxLength: max,
      }),
});

// An INTEGER column keeps 1.5 as a real and 'abc' as text: only typeof()
// refuses them. SQLite's integers go past what a JavaScript number holds
// exactly, and zod's z.int() refuses those, so the column does too
const isInteger: Constraint<z.ZodNumber> = {
  name: 'is_integer',
  check: (column) =>
    sql`typeof(${column}) = 'integer' AND ${column} BETWEEN ${sql.raw(String(Number.MIN_SAFE_INTEGER))} AND ${sql.raw(String(Number.MAX_SAFE_INTEGER))}`,
  rule: (schema) => schema,
};

// A REAL column makes an integer a real, but keeps 'abc' as text
const isReal: Constraint<z.ZodNumber> = {
  name: 'is_real',
  check: (column) => sql`typeof(${column}) = 'real'`,
  rule: (schema) => schema,
};

const compare = (column: SQLWrapper, operator: string, limit: number) =>
  sql`${column} ${sql.raw(operator)} ${sql.raw(String(limit))}`;

// A number's bounds, a CHECK each. A bound on its own lets text through (text
// sorts above every number, so 'abc' > 0): the kind's type check refuses it
const gt = (limit: number): Constraint<z.ZodNumber> => ({
  name: 'greater_than',
  check: (column) => compare(column, '>', limit),
  rule: (schema, label) =>
    schema.gt(limit, `${label} must be greater than ${limit}`),
});

const gte = (limit: number): Constraint<z.ZodNumber> => ({
  name: 'at_least',
  check: (column) => compare(column, '>=', limit),
  rule: (schema, label) =>
    schema.gte(limit, `${label} must be at least ${limit}`),
});

const lt = (limit: number): Constraint<z.ZodNumber> => ({
  name: 'less_than',
  check: (column) => compare(column, '<', limit),
  rule: (schema, label) =>
    schema.lt(limit, `${label} must be less than ${limit}`),
});

const lte = (limit: number): Constraint<z.ZodNumber> => ({
  name: 'at_most',
  check: (column) => compare(column, '<=', limit),
  rule: (schema, label) =>
    schema.lte(limit, `${label} must be at most ${limit}`),
});

// Drizzle's integer boolean reads anything but 1 as false, so the column holds
// only 0 and 1
const isBoolean: Constraint<z.ZodBoolean> = {
  name: 'is_boolean',
  check: (column) => sql`${column} IN (0, 1)`,
  rule: (schema) => schema,
};

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

// Written into the SQL, since a CHECK can't take parameters: values are
// constants, never input
// Generic, since its rule changes nothing: the enum keeps its own values' type
const oneOf = <TSchema extends z.ZodType>(
  values: readonly string[],
): Constraint<TSchema> => ({
  name: 'is_in_enum',
  check: (column) =>
    sql`${column} IN ${sql.raw(`(${values.map(quote).join(', ')})`)}`,
  rule: (schema) => schema,
});

// date() rewrites a valid date to itself and anything else to another date or
// NULL, so `IS` (NULL = x is NULL, which a CHECK lets through)
const isDate: Constraint<z.ZodISODate> = {
  name: 'is_date',
  check: (column) => sql`date(${column}) IS ${column}`,
  rule: (schema) => schema,
};

// toISOString()'s format: UTC, milliseconds, so text order is time order
const TIMESTAMP_FORMAT = '%Y-%m-%dT%H:%M:%fZ';

const isTimestamp: Constraint<z.ZodISODateTime> = {
  name: 'is_timestamp',
  check: (column) =>
    sql`strftime(${sql.raw(quote(TIMESTAMP_FORMAT))}, ${column}) IS ${column}`,
  rule: (schema) => schema,
};

// A v4 uuid as crypto.randomUUID() writes it: the shape, with version 4 and
// variant 8 to b (GLOB matches the whole value, so the length too), then
// nothing but lowercase hex. Two short patterns: D1 refuses a long one. GLOB
// reads a blob as text, so typeof() first
const UUID_V4_SHAPE = '????????-????-4???-[89ab]???-????????????';
const NOT_LOWERCASE_HEX = '*[^0-9a-f-]*';

// zod accepts uppercase, so the rule lowercases what the database stores
const isUuid: Constraint<z.ZodUUID> = {
  name: 'is_uuid',
  check: (column) =>
    sql`typeof(${column}) = 'text' AND ${column} GLOB ${sql.raw(quote(UUID_V4_SHAPE))} AND NOT ${column} GLOB ${sql.raw(quote(NOT_LOWERCASE_HEX))}`,
  rule: (schema) => schema.toLowerCase(),
};

export {
  TIMESTAMP_FORMAT,
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
};
export type { Constraint };
