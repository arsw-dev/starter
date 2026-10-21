import { noop, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';

import { todosApi } from '#/todos/todos.api.ts';

export const Route = createFileRoute('/')({
  component: RouteComponent,
  loader: ({ context }) => {
    void context.queryClient.query(todosApi.getAll()).catch(noop);
  },
});

function RouteComponent() {
  return (
    <Suspense fallback={<p>Loading todos</p>}>
      <Todos />
    </Suspense>
  );
}

function Todos() {
  const { data: todos } = useSuspenseQuery(todosApi.getAll());

  return (
    <div>
      {todos.map((todo) => (
        <span key={todo.id}>{todo.title}</span>
      ))}
    </div>
  );
}
