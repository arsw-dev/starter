import { noop, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense, useState } from 'react';

import { ApiError } from '#/api/api.error.ts';
import { todosApi } from '#/todos/todos.api.ts';

export const Route = createFileRoute('/')({
  component: RouteComponent,
  loader: ({ context }) => {
    void context.queryClient.query(todosApi.getAll()).catch(noop);
  },
});

function RouteComponent() {
  return (
    <main className="mx-auto flex max-w-160 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Todos</h1>
      <NewTodo />
      <Suspense fallback={<p className="text-slate-500">Loading todos</p>}>
        <Todos />
      </Suspense>
    </main>
  );
}

function NewTodo() {
  const [title, setTitle] = useState('');

  const create = useMutation(
    todosApi.create({
      onSuccess: () => {
        setTitle('');
      },
    }),
  );

  // What todos-api said was wrong with the title, in its own words
  const problems =
    create.error instanceof ApiError
      ? create.error.issues
          .filter((issue) => issue.path === 'title')
          .map((issue) => issue.message)
      : [];

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({
          title,
        });
      }}
    >
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
          aria-label="New todo"
          placeholder="What needs doing?"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <button
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          type="submit"
          disabled={create.isPending}
        >
          Add
        </button>
      </div>
      {create.isError && (
        <p className="text-sm text-red-600" role="alert">
          {problems.length > 0
            ? problems.join(' ')
            : "Couldn't add it. Try again."}
        </p>
      )}
    </form>
  );
}

function Todos() {
  const { data: todos } = useSuspenseQuery(todosApi.getAll());

  const remove = useMutation(todosApi.delete());

  if (todos.length === 0) {
    return <p className="text-slate-500">Nothing to do.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-center gap-4 px-4 py-3">
          <span className="flex-1 text-slate-900">{todo.title}</span>
          <button
            className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-50"
            type="button"
            disabled={remove.isPending && remove.variables.id === todo.id}
            onClick={() => {
              remove.mutate({
                id: todo.id,
              });
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
