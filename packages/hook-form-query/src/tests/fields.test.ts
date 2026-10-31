import { describe, expect, it } from 'vite-plus/test';

import { zBoolean, zEnum, zNumber, zString, zUnion } from '#/fields.ts';

import { contactSchema } from './contact.ts';

import type { Contact } from './contact.ts';
import type { z } from 'zod';

// The data, or the first issue's message
const parse = (schema: z.ZodType, value: unknown) => {
  const result = schema.safeParse(value);

  return result.success ? result.data : result.error.issues[0]?.message;
};

// Each issue as its path and message, for what a form would show on each field
const issues = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues.map(({ path, message }) => ({
    path,
    message,
  }));

// What's checked is whether it compiles: it never runs
const emailOf = (contact: Contact) => {
  if (contact.method === 'email') {
    // @ts-expect-error a phone is only on the phone branch
    const phone = contact.phone;

    return [contact.name, contact.email, phone];
  }

  // @ts-expect-error an email is only on the email branch
  return contact.email;
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

  it("rejects text that isn't wholly a number in decimal notation", () => {
    expect(parse(number, '12abc')).toBe('Must be a number');
    expect(parse(number, '1,000')).toBe('Must be a number');
    expect(parse(number, '0x10')).toBe('Must be a number');
    expect(parse(number, '1e3')).toBe('Must be a number');
    expect(parse(number, '.5')).toBe(0.5);
  });

  it("refines the number, keeping an empty one's message", () => {
    const estimate = zNumber({
      type: 'required',
      refine: (value) =>
        value.int('Must be a whole number').min(1, 'Must be at least 1'),
    });

    expect(parse(estimate, '2')).toBe(2);
    expect(parse(estimate, '1.5')).toBe('Must be a whole number');
    expect(parse(estimate, '0')).toBe('Must be at least 1');
    expect(parse(estimate, '')).toBe('Required');
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

describe('zUnion', () => {
  it('parses each branch to its shared and own fields, with the discriminator', () => {
    expect(
      parse(contactSchema, {
        name: ' Sam ',
        method: 'email',
        email: ' sam@example.com ',
      }),
    ).toStrictEqual({
      name: 'Sam',
      method: 'email',
      email: 'sam@example.com',
    });
    expect(
      parse(contactSchema, {
        name: 'Sam',
        method: 'phone',
        phone: '555',
      }),
    ).toStrictEqual({
      name: 'Sam',
      method: 'phone',
      phone: '555',
    });
    expect(
      parse(contactSchema, {
        name: 'Sam',
        method: 'none',
      }),
    ).toStrictEqual({
      name: 'Sam',
      method: 'none',
    });
  });

  it('strips what another branch left behind', () => {
    expect(
      parse(contactSchema, {
        name: 'Sam',
        method: 'phone',
        phone: '555',
        email: 'sam@example.com',
      }),
    ).toStrictEqual({
      name: 'Sam',
      method: 'phone',
      phone: '555',
    });
  });

  it("isn't held up by a required field on another branch", () => {
    expect(
      contactSchema.safeParse({
        name: 'Sam',
        method: 'none',
        email: '',
        phone: '',
      }).success,
    ).toBe(true);
  });

  it("reports the chosen branch's fields and the shared ones together", () => {
    expect(
      issues(contactSchema, {
        name: '',
        method: 'email',
        email: '',
      }),
    ).toStrictEqual([
      {
        path: ['name'],
        message: 'Required',
      },
      {
        path: ['email'],
        message: 'Required',
      },
    ]);
  });

  it("leaves a field's own errors as they are", () => {
    expect(
      issues(contactSchema, {
        name: 'Sam',
        method: 'email',
        email: 'nope',
      }),
    ).toStrictEqual([
      {
        path: ['email'],
        message: 'Invalid email address',
      },
    ]);
  });

  it.each([
    {
      name: 'Sam',
    },
    {
      name: 'Sam',
      method: null,
    },
    {
      name: 'Sam',
      method: '',
    },
    {
      name: 'Sam',
      method: '   ',
    },
  ])('says Required on the discriminator for %j', (value) => {
    expect(issues(contactSchema, value)).toStrictEqual([
      {
        path: ['method'],
        message: 'Required',
      },
    ]);
  });

  it("keeps Zod's message for a value that isn't one of them", () => {
    expect(
      issues(contactSchema, {
        name: 'Sam',
        method: 'post',
      }),
    ).toStrictEqual([
      {
        path: ['method'],
        message: expect.stringMatching(/^Invalid discriminator/v),
      },
    ]);
  });

  it("keeps Zod's message for what isn't an object", () => {
    expect(parse(contactSchema, 'Sam')).toBe(
      'Invalid input: expected object, received string',
    );
  });

  describe('a field on both', () => {
    const size = zUnion({
      on: 'unit',
      values: ['label', 'count'],
      fields: {
        size: zString({
          type: 'required',
        }),
        unit: zString({
          type: 'required',
        }),
      },
      branches: {
        count: {
          size: zNumber({
            type: 'required',
          }),
          unit: zNumber({
            type: 'required',
          }),
        },
      },
    });

    it("is the branch's, in what it parses to", () => {
      expect(
        parse(size, {
          unit: 'count',
          size: '3',
        }),
      ).toStrictEqual({
        unit: 'count',
        size: 3,
      });
      expect(
        parse(size, {
          unit: 'label',
          size: '3',
        }),
      ).toStrictEqual({
        unit: 'label',
        size: '3',
      });
    });

    it("is the branch's in the types too", () => {
      const count: Extract<
        z.output<typeof size>,
        {
          unit: 'count';
        }
      >['size'] = 3;
      const label: Extract<
        z.output<typeof size>,
        {
          unit: 'label';
        }
      >['size'] = '3';
      // @ts-expect-error the branch's number replaced the shared text
      const text: Extract<
        z.output<typeof size>,
        {
          unit: 'count';
        }
      >['size'] = '3';

      expect([count, label, text]).toHaveLength(3);
    });

    it('never replaces the discriminator', () => {
      const unit: z.output<typeof size>['unit'] = 'count';
      // @ts-expect-error the discriminator stays its literal, whatever a branch says
      const number: z.output<typeof size>['unit'] = 3;

      expect([unit, number]).toHaveLength(2);
      expect(
        parse(size, {
          unit: 'count',
          size: '3',
        }),
      ).toHaveProperty('unit', 'count');
    });
  });

  describe('the types', () => {
    it('narrow on the discriminator, each branch with its own fields', () => {
      expect(emailOf).toBeTypeOf('function');
    });

    it('take a key in branches only from the values', () => {
      const schema = zUnion({
        on: 'method',
        values: ['email', 'none'],
        fields: {},
        branches: {
          email: {
            email: zString({
              type: 'required',
            }),
          },
          // @ts-expect-error not one of the values
          post: {
            address: zString({
              type: 'required',
            }),
          },
        },
      });

      expect(schema).toBeDefined();
    });

    it('stay precise when the values are a plain list', () => {
      type Status = 'active' | 'archived';

      const statuses: Status[] = ['active', 'archived'];
      const schema = zUnion({
        on: 'status',
        values: statuses,
        fields: {
          name: zString({
            type: 'required',
          }),
        },
        branches: {
          archived: {
            reason: zString({
              type: 'required',
            }),
          },
        },
      });

      type Output = z.output<typeof schema>;

      const active: Output = {
        status: 'active',
        name: 'Sam',
      };
      const archived: Output = {
        status: 'archived',
        name: 'Sam',
        reason: 'Moved',
      };
      // @ts-expect-error an archived one needs its reason
      const unexplained: Output = {
        status: 'archived',
        name: 'Sam',
      };
      const other: Output = {
        // @ts-expect-error not a status
        status: 'other',
        name: 'Sam',
      };

      expect([active, archived, unexplained, other]).toHaveLength(4);
    });
  });
});
