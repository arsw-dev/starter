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
  estimate: zNumber({
    type: 'optional',
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
