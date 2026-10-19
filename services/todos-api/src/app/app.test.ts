import { expect, it } from 'vite-plus/test';

import { NotFound } from '#/http/http.errors.ts';

import { createApp } from './app.ts';

it('turns a thrown NotFound into a 404 with its message', async () => {
  const app = createApp();

  app.get('/todo', () => {
    throw new NotFound('Todo not found');
  });

  const response = await app.request('/todo');

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    message: 'Todo not found',
  });
});
