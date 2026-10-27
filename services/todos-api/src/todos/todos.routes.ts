import { z } from '@hono/zod-openapi';

import { defineRoute } from '@arsw/kiln';

import { todosModel } from './todos.model.ts';
import { todosOps } from './todos.operations.ts';

const getTodo = defineRoute({
  method: 'get',
  path: '/{id}',
  params: todosModel.paramsSchema,
  response: todosModel.readSchema,
  description: 'One todo',
  errors: {
    notFound: 'Cannot find todo',
  },
  handler: async (c, errors) => {
    const todo = await todosOps.get(c.var.db, c.req.valid('param').id);

    if (!todo) return errors.notFound();

    return c.json(todo, 200);
  },
});

const getAllTodos = defineRoute({
  method: 'get',
  path: '/',
  response: z.array(todosModel.readSchema),
  description: 'All todos',
  handler: async (c) => c.json(await todosOps.getAll(c.var.db), 200),
});

const createTodo = defineRoute({
  method: 'post',
  path: '/',
  body: {
    schema: todosModel.createSchema,
    description: 'Todo to create',
  },
  status: 201,
  response: todosModel.readSchema,
  description: 'Todo created',
  handler: async (c) =>
    c.json(await todosOps.create(c.var.db, c.req.valid('json')), 201),
});

const updateTodo = defineRoute({
  method: 'patch',
  path: '/{id}',
  params: todosModel.paramsSchema,
  body: {
    schema: todosModel.updateSchema,
    description: 'Updates to todo',
  },
  response: todosModel.readSchema,
  description: 'Updated todo',
  errors: {
    notFound: 'Cannot find todo',
  },
  handler: async (c, errors) => {
    const todo = await todosOps.update(
      c.var.db,
      c.req.valid('param').id,
      c.req.valid('json'),
    );

    if (!todo) return errors.notFound();

    return c.json(todo, 200);
  },
});

const deleteTodo = defineRoute({
  method: 'delete',
  path: '/{id}',
  params: todosModel.paramsSchema,
  status: 204,
  description: 'Todo deleted',
  errors: {
    notFound: 'Cannot find todo',
  },
  handler: async (c, errors) => {
    const deleted = await todosOps.delete(c.var.db, c.req.valid('param').id);

    if (!deleted) return errors.notFound();

    return c.newResponse(null, 204);
  },
});

// Registered in this order, which matters only where paths overlap
const todosRoutes = {
  getTodo,
  getAllTodos,
  createTodo,
  updateTodo,
  deleteTodo,
};

export { todosRoutes };
