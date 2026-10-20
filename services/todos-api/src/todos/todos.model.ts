import { defineModel } from '#/db/db.ts';
import { enumOf, field } from '#/model/model.fields.ts';

const PRIORITIES = enumOf(['low', 'medium', 'high']);

const EVERYONE = ['read', 'create', 'update'] as const;

// A todo starts not done: done is only ever set by an update
const todos = defineModel('todos', {
  title: field.text({
    notBlank: true,
    maxLength: 200,
    access: EVERYONE,
  }),
  done: field.boolean({
    default: false,
    access: ['read', 'update'],
  }),
  priority: field.enum(PRIORITIES, {
    default: 'medium',
    access: EVERYONE,
  }),
  estimate: field.number({
    type: 'integer',
    gte: 1,
    optional: true,
    access: EVERYONE,
  }),
  dueDate: field.date({
    optional: true,
    access: EVERYONE,
  }),
});

// drizzle-kit only finds a table exported on its own
const todosTable = todos.table;

export { todos, todosTable };
