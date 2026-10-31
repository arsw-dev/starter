import { zString, zUnion } from '#/fields.ts';

import type { z } from 'zod';

const METHODS = ['email', 'phone', 'none'] as const;

const contactSchema = zUnion({
  on: 'method',
  values: METHODS,
  fields: {
    name: zString({
      type: 'required',
    }),
  },
  branches: {
    email: {
      email: zString({
        type: 'required',
        refine: (string, zod) => string.check(zod.email()),
      }),
    },
    phone: {
      phone: zString({
        type: 'required',
      }),
    },
  },
});

type Contact = z.output<typeof contactSchema>;

// What an API behind the form takes, written apart from the schema
type ContactVariables =
  | {
      name: string;
      method: 'email';
      email: string;
    }
  | {
      name: string;
      method: 'phone';
      phone: string;
    }
  | {
      name: string;
      method: 'none';
    };

export { contactSchema };
export type { Contact, ContactVariables };
