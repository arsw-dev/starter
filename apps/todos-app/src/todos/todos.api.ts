import { createServerFn } from '@tanstack/react-start';

import { defineApi } from '@arsw/start-hono';

import { call } from '#/api/api.server.ts';

import type { Client } from '@arsw/start-hono/server';
import type { AppType } from '@arsw/todos-api/client';
import type { QueryKey } from '@tanstack/react-query';
import type { InferRequestType } from 'hono/client';

type TodosClient = Client<AppType>;

type NewTodo = InferRequestType<TodosClient['todos']['$post']>['json'];

type TodoId = InferRequestType<TodosClient['todos'][':id']['$delete']>['param'];

const getAll = createServerFn({
  method: 'GET',
}).handler(call((client) => client.todos.$get()));

// The input is typed, not checked: todos-api checks it, and its 422 comes back
// as an ApiError. A server function that reaches its own data (KV, a secret,
// another service) rather than an API checks its input, with a Zod schema in
// .validator()
const create = createServerFn({
  method: 'POST',
})
  .validator((todo: NewTodo) => todo)
  .handler(
    call((client, todo) =>
      client.todos.$post({
        json: todo,
      }),
    ),
  );

const remove = createServerFn({
  method: 'POST',
})
  .validator((param: TodoId) => param)
  .handler(
    call((client, param) =>
      client.todos[':id'].$delete({
        param,
      }),
    ),
  );

const todosApi = defineApi('todos', (api) => ({
  getAll: api.query(getAll),
  create: api.mutation(create, {
    invalidates: (): QueryKey[] => [todosApi.getAll.baseKey],
  }),
  delete: api.mutation(remove, {
    invalidates: (): QueryKey[] => [todosApi.getAll.baseKey],
  }),
}));

export { todosApi };
