import { defineModel } from '#/db/db.ts';

const todosModel = defineModel('todos', (field) => ({
  title: field.text({
    notBlank: true,
    maxLength: 200,
    access: 'all',
  }),
  // A todo starts not done: only an update sets it
  done: field.boolean({
    default: false,
    access: ['read', 'update'],
  }),
  priority: field.enum(['low', 'medium', 'high'], {
    default: 'medium',
    access: 'all',
  }),
  estimate: field.number({
    type: 'integer',
    gte: 1,
    optional: true,
    access: 'all',
  }),
  dueDate: field.date({
    optional: true,
    access: 'all',
  }),
}));

// drizzle-kit only finds a table exported on its own
const todosTable = todosModel.table;

export { todosModel, todosTable };
