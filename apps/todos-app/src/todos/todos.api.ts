import { createServerFn } from '@tanstack/react-start';

import { call } from '#/api/api.call.ts';
import { defineApi } from '#/api/api.factory.ts';

const getAll = createServerFn({
  method: 'GET',
}).handler(call((client) => client.todos.$get()));

const todosApi = defineApi('todos', (api) => ({
  getAll: api.query(getAll),
}));

export { todosApi };
