import { createFileRoute } from '@tanstack/react-router';

import { todosFns } from '#/todos/todos.functions.ts';

export const Route = createFileRoute('/')({
  component: RouteComponent,
  loader: async () => {
    const todos = await todosFns.getAll();

    return {
      todos,
    };
  },
});

function RouteComponent() {
  const { todos } = Route.useLoaderData();

  return (
    <div>
      {todos.map((todo) => (
        <span key={todo.id}>{todo.title}</span>
      ))}
    </div>
  );
}
