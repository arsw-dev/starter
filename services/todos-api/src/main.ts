import { createApp } from './app.ts';
import { todosRouter } from './todos/todos.router.ts';

const app = createApp().route('/todos', todosRouter);

export default app;
