import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { z } from 'zod';

import { Form } from '#/components/form.tsx';
import { zBoolean, zEnum, zNumber, zString } from '#/fields.ts';
import { useFormMutation } from '#/use-form-mutation.ts';

import type { ReactNode } from 'react';
import type { DefaultValues } from 'react-hook-form';

// One form for every field test: each renders the fields it needs, and the
// defaults fill the required ones it doesn't
const schema = z.object({
  title: zString({
    type: 'required',
  }),
  notes: zString({
    type: 'optional',
  }),
  estimate: zNumber({
    type: 'optional',
  }),
  priority: zEnum({
    type: 'optional',
    values: ['low', 'high'],
  }),
  size: zEnum({
    type: 'required',
    values: ['small', 'large'],
  }),
  done: zBoolean({
    type: 'optional',
  }),
});

type Todo = z.output<typeof schema>;

const filled = {
  title: 'Buy milk',
  size: 'small',
} as const;

const priorities = [
  {
    value: 'low',
    label: 'Low',
  },
  {
    value: 'high',
    label: 'High',
  },
];

const sizes = [
  {
    value: 'small',
    label: 'Small',
  },
  {
    value: 'large',
    label: 'Large',
  },
];

// Renders the fields in a create form, which records what it sends
const renderForm = (
  fields: ReactNode,
  values: DefaultValues<z.input<typeof schema>> = filled,
) => {
  const sent: Todo[] = [];
  const user = userEvent.setup();

  const Harness = () => {
    const { form, onSubmit } = useFormMutation({
      schema,
      defaultValues: values,
      mutation: {
        mutationKey: ['todos', 'create'],
        mutationFn: async (todo: Todo) => {
          sent.push(todo);
        },
      },
    });

    return (
      <Form form={form} onSubmit={onSubmit}>
        {fields}
        <button type="submit">Save</button>
      </Form>
    );
  };

  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );

  const submit = async () => {
    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    );
  };

  return {
    sent,
    submit,
    user,
  };
};

export { filled, priorities, renderForm, sizes };
export type { Todo };
