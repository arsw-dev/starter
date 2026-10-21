import { createRouter } from '#/http/http.router.ts';

import { listTodosHandler } from './todos.handlers.ts';
import { listTodos } from './todos.routes.ts';

const todosRouter = createRouter().openapi(listTodos, listTodosHandler);

export { todosRouter };
