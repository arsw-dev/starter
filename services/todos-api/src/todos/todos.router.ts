import { createRoute, z } from '@hono/zod-openapi';

import { createRouter } from '#/http/http.router.ts';
import {
  errorSchema,
  invalidSchema,
  json,
  malformedBody,
  serverError,
} from '#/http/http.schemas.ts';

import { todosModel } from './todos.model.ts';
import { todosOps } from './todos.operations.ts';

const getTodoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: todosModel.paramsSchema,
  },
  responses: {
    200: json(todosModel.readSchema, 'One todo'),
    404: json(errorSchema, 'Cannot find todo'),
    422: json(invalidSchema, 'The id must be a uuid'),
    ...serverError,
  },
});

const getAllTodosRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: json(z.array(todosModel.readSchema), 'All todos'),
    ...serverError,
  },
});

const createTodoRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      required: true,
      ...json(todosModel.createSchema, 'Todo to create'),
    },
  },
  responses: {
    201: json(todosModel.readSchema, 'Todo created'),
    422: json(invalidSchema, 'The create body is invalid'),
    ...malformedBody,
    ...serverError,
  },
});

const updateTodoRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  request: {
    params: todosModel.paramsSchema,
    body: {
      required: true,
      ...json(todosModel.updateSchema, 'Updates to todo'),
    },
  },
  responses: {
    200: json(todosModel.readSchema, 'Updated todo'),
    404: json(errorSchema, 'Cannot find todo'),
    422: json(invalidSchema, 'The id or update body is invalid'),
    ...malformedBody,
    ...serverError,
  },
});

const deleteTodoRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: todosModel.paramsSchema,
  },
  responses: {
    204: {
      description: 'Todo deleted',
    },
    404: json(errorSchema, 'Cannot find todo'),
    422: json(invalidSchema, 'The id must be a uuid'),
    ...serverError,
  },
});

const todosRouter = createRouter()
  .basePath('/todos')
  .openapi(getTodoRoute, async (c) =>
    c.json(await todosOps.get(c.var.db, c.req.valid('param').id), 200),
  )
  .openapi(getAllTodosRoute, async (c) =>
    c.json(await todosOps.getAll(c.var.db), 200),
  )
  .openapi(createTodoRoute, async (c) =>
    c.json(await todosOps.create(c.var.db, c.req.valid('json')), 201),
  )
  .openapi(updateTodoRoute, async (c) =>
    c.json(
      await todosOps.update(
        c.var.db,
        c.req.valid('param').id,
        c.req.valid('json'),
      ),
      200,
    ),
  )
  .openapi(deleteTodoRoute, async (c) => {
    await todosOps.delete(c.var.db, c.req.valid('param').id);

    return c.newResponse(null, 204);
  });

export { todosRouter };
