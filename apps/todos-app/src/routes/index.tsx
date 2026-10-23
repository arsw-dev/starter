import { noop, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';
import { toast } from 'sonner';

import { Form, useFormMutation } from '@arsw/hook-form-query';
import { ApiError } from '@arsw/start-hono';

import { FormInput, FormSelect } from '#/components/form-fields.tsx';
import { todosApi } from '#/todos/todos.api.ts';
import { createTodoSchema } from '#/todos/todos.forms.ts';

import type { CreateTodo } from '#/todos/todos.forms.ts';

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

// What todos-api said was wrong, field by field
const describeFailure = (error: Error) =>
  error instanceof ApiError && error.issues.length > 0
    ? error.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' · ')
    : "Couldn't add it. Try again.";

const NewTodo = () => {
  const { form, formId, onSubmit, isSubmitting } = useFormMutation({
    schema: createTodoSchema,
    mutation: todosApi.create({
      onSuccess: () => {
        form.reset();
      },
      onError: (error) => {
        toast.error(describeFailure(error));
      },
    }),
  });

  return (
    // A submitting form pulses rather than locking, as a sign to leave it be
    <Form
      className={`flex flex-col gap-4 ${isSubmitting ? 'animate-pulse' : ''}`}
      id={formId}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    >
      <FormInput<CreateTodo>
        name="title"
        label="Title"
        placeholder="What needs doing?"
      />
      <div className="grid grid-cols-3 gap-4">
        <FormSelect<CreateTodo>
          name="priority"
          label="Priority"
          placeholder="Default"
          options={[
            {
              value: 'low',
              label: 'Low',
            },
            {
              value: 'medium',
              label: 'Medium',
            },
            {
              value: 'high',
              label: 'High',
            },
          ]}
        />
        <FormInput<CreateTodo>
          name="estimate"
          label="Estimate"
          description="Hours"
        />
        <FormInput<CreateTodo> name="dueDate" label="Due" type="date" />
      </div>
      <button
        className="self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
        type="submit"
      >
        Add
      </button>
    </Form>
  );
};

const Todos = () => {
  const { data: todos } = useSuspenseQuery(todosApi.getAll());

  const remove = useMutation(todosApi.delete());

  if (todos.length === 0) {
    return <p className="text-slate-500">Nothing to do.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-center gap-4 px-4 py-3">
          <div className="flex flex-1 flex-col">
            <span className="text-slate-900">{todo.title}</span>
            <span className="text-sm text-slate-500">
              {[
                todo.priority,
                todo.estimate && `${todo.estimate}h`,
                todo.dueDate && `due ${todo.dueDate}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
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
};
