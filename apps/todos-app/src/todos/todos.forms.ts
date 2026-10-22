import { z } from 'zod';

import { zEnum, zNumber, zString } from '@arsw/hook-form-query';

// What a new todo's form sends: anything left empty is left out, so todos-api's
// defaults apply
const createTodoSchema = z.object({
  title: zString({
    type: 'required',
    refine: (string) => string.max(200),
  }),
  priority: zEnum({
    type: 'optional',
    values: ['low', 'medium', 'high'],
  }),
  // As todos-api checks it, so the form says so before the API has to
  estimate: zNumber({
    type: 'optional',
    refine: (number) =>
      number.int('Must be a whole number').min(1, 'Must be at least 1'),
  }),
  // A calendar day, as the text todos-api takes
  dueDate: zString({
    type: 'optional',
    refine: (string, zod) => string.check(zod.iso.date()),
  }),
});

type CreateTodo = z.output<typeof createTodoSchema>;

export { createTodoSchema };
export type { CreateTodo };
