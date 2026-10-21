import { createServerFn } from '@tanstack/react-start';

import { api } from '#/api/api.server.ts';

const getAll = createServerFn({
  method: 'GET',
}).handler(async () => {
  const response = await api().todos.$get();

  if (!response.ok) throw new Error(`todos-api answered ${response.status}`);

  return response.json();
});

const todosFns = {
  getAll,
};

export { todosFns };
