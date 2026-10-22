import { z } from 'zod';

// What a field holds: never empty, empty sent as undefined (a create's
// default), or empty sent as null (an update's clear)
type Presence = 'required' | 'optional' | 'nullable';

// A boolean is a flag, never cleared to null, so it has no nullable
type Flag = Exclude<Presence, 'nullable'>;

type Options<TPresence extends Presence> = {
  type: TPresence;
};

type StringOptions<
  TPresence extends Presence,
  TSchema extends z.ZodType<unknown, string>,
> = Options<TPresence> & {
  // Builds on the trimmed string: a format, a pattern, a transform. Zod comes
  // along so a schema needs no import of its own
  refine?: (string: z.ZodString, zod: typeof z) => TSchema;
};

type NumberOptions<
  TPresence extends Presence,
  TSchema extends z.ZodType<unknown, number>,
> = Options<TPresence> & {
  // Builds on the number: whole numbers, a range
  refine?: (number: z.ZodNumber, zod: typeof z) => TSchema;
};

type EnumOptions<
  TPresence extends Presence,
  TValues extends readonly [string, ...string[]],
> = Options<TPresence> & {
  values: TValues;
};

type Issue = {
  input: unknown;
};

// What an empty field becomes. Required stays undefined, so the type check
// rejects it as "Required"
const empties = {
  required: undefined,
  optional: undefined,
  nullable: null,
} as const;

// Whitespace, '', null and undefined all count as empty
const isEmpty = (value: unknown) =>
  value == null || (typeof value === 'string' && value.trim() === '');

// What a field takes: text from a form, or its own kind of value, as a
// server's values hold it
type Text = string | null | undefined;

// Every field's first step: empty becomes its type's empty value, and the rest
// is converted from the string a form gives
const emptyOr = (
  type: Presence,
  convert: (value: string) => unknown,
  value: unknown,
) => {
  if (isEmpty(value)) {
    return empties[type];
  }

  return typeof value === 'string' ? convert(value.trim()) : value;
};

const required = (issue: Issue) =>
  issue.input === undefined ? 'Required' : undefined;

// NaN reaches the check as a number, so it gets its own message
const numberError = (issue: Issue) => required(issue) ?? 'Must be a number';

const keep = (value: string) => value;

// Plain decimal notation only: Number() alone would also read 0x10, 0b11 and
// 1e3
const decimal = /^[+\-]?(?:\d+\.?\d*|\.\d+)$/v;

// Anything else is NaN, which the check rejects
const toNumber = (value: string) =>
  decimal.test(value) ? Number(value) : Number.NaN;

// 'true' and 'false' in any case; anything else is left for the check to
// reject
const toBoolean = (value: string) => {
  const text = value.toLowerCase();

  if (text === 'true') {
    return true;
  }

  return text === 'false' ? false : value;
};

const booleans = {
  required: z.boolean({
    error: required,
  }),
  optional: z.boolean().optional(),
};

// A text field, trimmed
const zString = <
  TPresence extends Presence,
  TSchema extends z.ZodType<unknown, string> = z.ZodString,
>({
  type,
  refine,
}: StringOptions<TPresence, TSchema>) => {
  const string = z.string({
    error: required,
  });
  // Without refine, TSchema is its default, the plain string
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TypeScript can't tie a missing refine to TSchema's default
  const schema = (refine ? refine(string, z) : string) as TSchema;
  const strings = {
    required: schema,
    optional: schema.optional(),
    nullable: schema.nullable(),
  };

  return z.preprocess(
    (value: Text) => emptyOr(type, keep, value),
    strings[type],
  );
};

// A number typed as text, or a number as a server's values hold it
const zNumber = <
  TPresence extends Presence,
  TSchema extends z.ZodType<unknown, number> = z.ZodNumber,
>({
  type,
  refine,
}: NumberOptions<TPresence, TSchema>) => {
  const number = z.number({
    error: numberError,
  });
  // As in zString, without refine TSchema is the plain number
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TypeScript can't tie a missing refine to TSchema's default
  const schema = (refine ? refine(number, z) : number) as TSchema;
  const numbers = {
    required: schema,
    optional: schema.optional(),
    nullable: schema.nullable(),
  };

  return z.preprocess(
    (value: Text | number) => emptyOr(type, toNumber, value),
    numbers[type],
  );
};

// A flag, from a switch or a yes/no select
const zBoolean = <TFlag extends Flag>({ type }: Options<TFlag>) =>
  z.preprocess(
    (value: Text | boolean) => emptyOr(type, toBoolean, value),
    booleans[type],
  );

// One of a fixed set, as a select gives it
const zEnum = <
  TPresence extends Presence,
  const TValues extends readonly [string, ...string[]],
>({
  type,
  values,
}: EnumOptions<TPresence, TValues>) => {
  const enums = {
    required: z.enum(values, {
      error: required,
    }),
    optional: z.enum(values).optional(),
    nullable: z.enum(values).nullable(),
  };

  return z.preprocess((value: Text) => emptyOr(type, keep, value), enums[type]);
};

export { zBoolean, zEnum, zNumber, zString };
