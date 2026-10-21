import { createServerFn } from '@tanstack/react-start';

import { call } from '#/api/api.call.ts';
import { defineApi } from '#/api/api.factory.ts';

import type { ApiClient } from '#/api/api.server.ts';
import type { QueryKey } from '@tanstack/react-query';
import type { InferRequestType } from 'hono/client';

type NewTodo = InferRequestType<ApiClient['todos']['$post']>['json'];

type TodoId = InferRequestType<ApiClient['todos'][':id']['$delete']>['param'];

const getAll = createServerFn({
  method: 'GET',
}).handler(call((client) => client.todos.$get()));

// The input is typed, not checked: todos-api checks it, and its 422 comes back
// as an ApiError
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
