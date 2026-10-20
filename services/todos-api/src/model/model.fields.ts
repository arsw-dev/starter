import { z } from '@hono/zod-openapi';
import { integer, real, text } from 'drizzle-orm/sqlite-core';

import {
  gt,
  gte,
  isBoolean,
  isDate,
  isInteger,
  isReal,
  isText,
  lt,
  lte,
  maxLength,
  notBlank,
  oneOf,
  trimmed,
} from './model.constraints.ts';

import type { Constraint } from './model.constraints.ts';

type Access = 'read' | 'create' | 'update';

// What every kind of field takes
type FieldOptions<TValue> = {
  optional?: boolean;
  default?: TValue;
  // Who sees the field: `'all'`, or the uses listed. Required, so a field is
  // closed until it says otherwise
  access: 'all' | readonly Access[];
};

// A field's column and its schema come from one list of constraints, each a
// CHECK on the one and a rule on the other, so the two can't drift. The column
// is Drizzle's plain builder: defineModel applies `optional` and `default`
type Field<
  TBuilder,
  TSchema extends z.ZodType,
  O extends FieldOptions<unknown>,
> = {
  column: (name: string) => TBuilder;
  schema: (label: string) => TSchema;
  constraints: Pick<Constraint<TSchema>, 'name' | 'check'>[];
  options: O;
};

// What a type error's message needs from zod's issue
type TypeIssue = {
  input: unknown;
};

// zod reports a missing value as one of the wrong type, so the message tells
// them apart
const typeError = (label: string, expected: string) => (issue: TypeIssue) =>
  issue.input === undefined
    ? `${label} is required`
    : `${label} must be ${expected}`;

// The rules in the order the constraints are listed: the type first, then
// trimming, so a blank check and a length see the trimmed value
const withRules = <TSchema extends z.ZodType>(
  base: TSchema,
  constraints: Constraint<TSchema>[],
  label: string,
) => constraints.reduce((schema, c) => c.rule(schema, label), base);

const textField = <
  const O extends FieldOptions<string> & {
    // On unless turned off: untrimmed text is almost always a mistake
    trim?: boolean;
    notBlank?: boolean;
    maxLength?: number;
  },
>(
  options: O,
) => {
  const constraints = [
    isText,
    ...(options.trim === false ? [] : [trimmed]),
    ...(options.notBlank ? [notBlank] : []),
    ...(options.maxLength === undefined ? [] : [maxLength(options.maxLength)]),
  ];

  return {
    column: (name: string) => text(name),
    schema: (label: string) =>
      withRules(
        z.string({
          error: typeError(label, 'text'),
        }),
        constraints,
        label,
      ),
    constraints,
    options,
  };
};

const numberField = <
  const O extends FieldOptions<number> & {
    type: 'integer' | 'real';
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
  },
>(
  options: O,
) => {
  const isInt = options.type === 'integer';

  const constraints = [
    isInt ? isInteger : isReal,
    ...(options.gt === undefined ? [] : [gt(options.gt)]),
    ...(options.gte === undefined ? [] : [gte(options.gte)]),
    ...(options.lt === undefined ? [] : [lt(options.lt)]),
    ...(options.lte === undefined ? [] : [lte(options.lte)]),
  ];

  return {
    column: (name: string) => (isInt ? integer(name) : real(name)),
    schema: (label: string) =>
      withRules(
        isInt
          ? z.int({
              error: typeError(label, 'a whole number'),
            })
          : z.number({
              error: typeError(label, 'a number'),
            }),
        constraints,
        label,
      ),
    constraints,
    options,
  };
};

const booleanField = <const O extends FieldOptions<boolean>>(options: O) => {
  const constraints = [isBoolean];

  return {
    column: (name: string) =>
      integer(name, {
        mode: 'boolean',
      }),
    schema: (label: string) =>
      withRules(
        z.boolean({
          error: typeError(label, 'true or false'),
        }),
        constraints,
        label,
      ),
    constraints,
    options,
  };
};

// A list of values meant as an enum, said by name rather than by `as const`.
// (`enum` itself is a reserved word)
const enumOf = <const V extends readonly [string, ...string[]]>(values: V) =>
  values;

const enumField = <
  const V extends readonly [string, ...string[]],
  const O extends FieldOptions<V[number]>,
>(
  values: V,
  options: O,
) => {
  const base = (label: string) =>
    z.enum(values, {
      error: typeError(label, `one of ${values.join(', ')}`),
    });

  // Named, so the enum keeps its values' type through the rules
  const constraints = [oneOf<ReturnType<typeof base>>(values)];

  return {
    column: (name: string) =>
      text(name, {
        enum: values,
      }),
    schema: (label: string) => withRules(base(label), constraints, label),
    constraints,
    options,
  };
};

// A calendar date (a due date), never an instant: YYYY-MM-DD text
const dateField = <const O extends FieldOptions<string>>(options: O) => {
  const constraints = [isDate];

  return {
    column: (name: string) => text(name),
    schema: (label: string) =>
      withRules(
        z.iso.date({
          error: typeError(label, 'a date in YYYY-MM-DD format'),
        }),
        constraints,
        label,
      ),
    constraints,
    options,
  };
};

const field = {
  text: textField,
  number: numberField,
  boolean: booleanField,
  enum: enumField,
  date: dateField,
};

export { enumOf, field };
export type { Access, Field, FieldOptions };
