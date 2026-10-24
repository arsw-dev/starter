import { describe, expect, it } from 'vite-plus/test';

import { field } from '#/model/model.fields.ts';

import type { Field, FieldOptions } from '#/model/model.fields.ts';
import type { z } from '@hono/zod-openapi';

const names = (
  f: Pick<Field<unknown, z.ZodType, FieldOptions<unknown>>, 'constraints'>,
) => f.constraints.map((c) => c.name);

const messages = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues.map((issue) => issue.message);

describe('text', () => {
  const title = field.text({
    notBlank: true,
    maxLength: 3,
    access: [],
  });

  it('checks the type first, then trims, then the rest', () => {
    expect(names(title)).toEqual([
      'is_text',
      'is_trimmed',
      'not_blank',
      'max_length',
    ]);
  });

  it('checks blank and length on the trimmed value', () => {
    const schema = title.schema('Title');

    expect(messages(schema, '   ')).toEqual(["Title can't be blank"]);
    expect(schema.parse('  abc  ')).toBe('abc');
  });

  it('trims unless told not to, and checks nothing else unasked', () => {
    expect(
      names(
        field.text({
          access: [],
        }),
      ),
    ).toEqual(['is_text', 'is_trimmed']);

    expect(
      names(
        field.text({
          trim: false,
          access: [],
        }),
      ),
    ).toEqual(['is_text']);
  });
});

describe('number', () => {
  it('checks its type, then each bound', () => {
    expect(
      names(
        field.number({
          type: 'integer',
          gte: 1,
          lte: 10,
          access: [],
        }),
      ),
    ).toEqual(['is_integer', 'at_least', 'at_most']);

    expect(
      names(
        field.number({
          type: 'real',
          gt: 0,
          access: [],
        }),
      ),
    ).toEqual(['is_real', 'greater_than']);
  });

  it('refuses a fraction for an integer, not for a real', () => {
    const integer = field.number({
      type: 'integer',
      access: [],
    });

    const real = field.number({
      type: 'real',
      access: [],
    });

    expect(messages(integer.schema('Estimate'), 1.5)).toEqual([
      'Estimate must be a whole number',
    ]);
    expect(real.schema('Rating').parse(1.5)).toBe(1.5);
  });
});

describe('messages', () => {
  it('tells a missing value from one of the wrong type', () => {
    const schema = field
      .text({
        access: [],
      })
      .schema('Title');

    expect(messages(schema, undefined)).toEqual(['Title is required']);
    expect(messages(schema, 5)).toEqual(['Title must be text']);
  });

  it('says what each kind expects', () => {
    const none = {
      access: [],
    };

    expect(messages(field.boolean(none).schema('Done'), 'yes')).toEqual([
      'Done must be true or false',
    ]);
    expect(
      messages(field.enum(['low', 'high'], none).schema('Priority'), 'mid'),
    ).toEqual(['Priority must be one of low, high']);
    expect(messages(field.date(none).schema('Due date'), '2026-1-5')).toEqual([
      'Due date must be a date in YYYY-MM-DD format',
    ]);
  });
});
