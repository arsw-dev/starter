import { ruleTester } from '#/rules/rule.tester.ts';

import { namedColumns } from './named-columns.ts';

const whole = (code: string) => ({
  code,
  errors: [
    {
      messageId: 'whole',
    },
  ],
});

ruleTester.run('named-columns', namedColumns, {
  valid: [
    'db.select(todos.readColumns).from(todos.table);',
    'db.insert(todos.table).values(todo).returning(todos.readColumns);',
    'db.delete(todos.table).returning({\n  id: todos.table.id,\n});',
    'db.selectDistinct(todos.readColumns).from(todos.table);',
    // Only a call takes the whole row
    'const select = db.select;',
    // Other calls with no arguments
    'db.delete(todos.table).run();',
    'query.all();',
  ],
  invalid: [
    whole('db.select().from(todos.table);'),
    whole('db.selectDistinct().from(todos.table);'),
    whole('db.insert(todos.table).values(todo).returning();'),
    whole('db.update(todos.table).set(updates).returning();'),
    whole('db.delete(todos.table).returning();'),
  ],
});
