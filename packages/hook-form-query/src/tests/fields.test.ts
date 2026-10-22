import { describe, expect, it } from 'vite-plus/test';

import { zBoolean, zEnum, zNumber, zString } from '#/fields.ts';

import type { z } from 'zod';

// The data, or the first issue's message
const parse = (schema: z.ZodType, value: unknown) => {
  const result = schema.safeParse(value);

  return result.success ? result.data : result.error.issues[0]?.message;
};

describe('every field', () => {
  it.each(['', '   ', null, undefined])(
    'takes %j as empty: an error, undefined or null by its type',
    (value) => {
      expect(
        parse(
          zString({
            type: 'required',
          }),
          value,
        ),
      ).toBe('Required');
      expect(
        parse(
          zNumber({
            type: 'optional',
          }),
          value,
        ),
      ).toBeUndefined();
      expect(
        parse(
          zEnum({
            type: 'nullable',
            values: ['low', 'high'],
          }),
          value,
        ),
      ).toBeNull();
    },
  );
});

describe('zString', () => {
  it('trims', () => {
    expect(
      parse(
        zString({
          type: 'required',
        }),
        '  Buy milk  ',
      ),
    ).toBe('Buy milk');
  });

  it("refines the trimmed string, keeping an empty one's message", () => {
    const email = zString({
      type: 'required',
      refine: (string, zod) => string.check(zod.email()),
    });

    expect(parse(email, ' a@b.co ')).toBe('a@b.co');
    expect(parse(email, 'nope')).toBe('Invalid email address');
    expect(parse(email, '')).toBe('Required');
  });

  it("types its output by its type and refine's output", () => {
    const due = zString({
      type: 'nullable',
      refine: (string) => string.transform((value) => value.length),
    });

    const output: z.output<typeof due> = null;
    // @ts-expect-error a nullable field is never undefined
    const missing: z.output<typeof due> = undefined;
    // @ts-expect-error the refine's transform made it a number
    const text: z.output<typeof due> = 'text';

    expect([output, missing, text]).toHaveLength(3);
  });
});

describe('zNumber', () => {
  const number = zNumber({
    type: 'required',
  });

  it('reads the text as a number', () => {
    expect(parse(number, ' 42 ')).toBe(42);
    expect(parse(number, '-1.5')).toBe(-1.5);
  });

  it("rejects text that isn't wholly a number", () => {
    expect(parse(number, '12abc')).toBe('Must be a number');
    expect(parse(number, '1,000')).toBe('Must be a number');
  });
});

describe('zBoolean', () => {
  const flag = zBoolean({
    type: 'required',
  });

  it("reads 'true' and 'false' in any case", () => {
    expect(parse(flag, ' TRUE ')).toBe(true);
    expect(parse(flag, 'False')).toBe(false);
  });

  it('rejects any other text rather than reading it as false', () => {
    expect(parse(flag, 'on')).toBe(
      'Invalid input: expected boolean, received string',
    );
  });

  it('has no nullable', () => {
    const nullable = zBoolean({
      // @ts-expect-error a boolean is never cleared to null
      type: 'nullable',
    });

    expect(nullable).toBeDefined();
  });
});

describe('zEnum', () => {
  const priority = zEnum({
    type: 'required',
    values: ['low', 'medium', 'high'],
  });

  it('takes one of its values, trimmed', () => {
    expect(parse(priority, ' high ')).toBe('high');
  });

  it("rejects a value that isn't one, in any case", () => {
    expect(parse(priority, 'High')).toMatch(/^Invalid option/v);
  });
});
