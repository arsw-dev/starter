import { mutationOptions } from '@tanstack/react-query';
import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';

import { zEnum, zNumber, zString } from '#/fields.ts';
import { useFormMutation } from '#/use-form-mutation.ts';

const schema = z.object({
  title: zString({
    type: 'required',
  }),
  priority: zEnum({
    type: 'nullable',
    values: ['low', 'high'],
  }),
  estimate: zNumber({
    type: 'nullable',
  }),
});

type Todo = z.output<typeof schema>;

type Update = {
  id: string;
  patch: Partial<Todo>;
};

const create = mutationOptions({
  mutationKey: ['todos', 'create'],
  mutationFn: async (todo: Todo) => todo,
});

const update = mutationOptions({
  mutationKey: ['todos', 'update'],
  mutationFn: async (variables: Update) => variables,
});

// What's checked is whether each call compiles: the hook never runs
const calls = () => {
  const { form, setValues } = useFormMutation({
    schema,
    mutation: create,
    defaultValues: {
      title: '',
      // @ts-expect-error not one of the schema's fields
      whatever: true,
    },
  });

  form.setValue('title', 'Buy milk');
  // @ts-expect-error not one of the schema's fields
  form.setValue('not-a-field', 'Buy milk');
  setValues({
    // @ts-expect-error a title is text
    title: 42,
  });

  useFormMutation({
    schema,
    mutation: update,
    update: true,
    values: {
      title: 'Buy milk',
      priority: null,
      estimate: 3,
      // @ts-expect-error not one of the schema's fields
      nope: 1,
    },
    toVariables: (patch) => ({
      id: '1',
      patch,
    }),
  });

  // @ts-expect-error the mutation takes { id, patch }, and there's no toVariables to build it
  useFormMutation({
    schema,
    mutation: update,
    update: true,
  });
};

describe("useFormMutation's types", () => {
  it("follow the schema's fields", () => {
    expect(calls).toBeTypeOf('function');
  });
});
