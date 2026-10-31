import {
  QueryClient,
  QueryClientProvider,
  mutationOptions,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';

import { zEnum, zNumber, zString } from '#/fields.ts';
import { useFormMutation } from '#/use-form-mutation.ts';

import { contactSchema } from './contact.ts';

import type { Contact, ContactVariables } from './contact.ts';
import type { ReactNode } from 'react';

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

const createContact = mutationOptions({
  mutationKey: ['contacts', 'create'],
  mutationFn: async (contact: ContactVariables) => contact,
});

// The same union written out, as a form may already have it
const handWritten = z.discriminatedUnion('method', [
  z.object({
    name: zString({
      type: 'required',
    }),
    method: z.literal('email'),
    email: zString({
      type: 'required',
    }),
  }),
  z.object({
    name: zString({
      type: 'required',
    }),
    method: z.literal('none'),
  }),
]);

// What's checked is whether each call compiles: the hook never runs
const unionCalls = () => {
  useFormMutation({
    schema: contactSchema,
    mutation: createContact,
    defaultValues: {
      name: '',
    },
  });

  useFormMutation({
    schema: handWritten,
    mutation: createContact,
    defaultValues: {
      name: '',
    },
  });

  useFormMutation({
    schema: contactSchema,
    mutation: createContact,
    defaultValues: {
      // @ts-expect-error the discriminator holds one of its values, or nothing yet
      method: '',
    },
  });

  // @ts-expect-error the mutation takes a todo, not what the union parses to
  useFormMutation({
    schema: contactSchema,
    mutation: create,
  });

  // @ts-expect-error an update compares field by field, and a union has none
  useFormMutation({
    schema: contactSchema,
    mutation: {
      mutationKey: ['contacts', 'update'],
      mutationFn: async (patch: Partial<Contact>) => patch,
    },
    update: true,
  });

  // A refined object keeps its fields, so it still updates
  useFormMutation({
    schema: schema.refine((todo) => todo.title !== todo.priority),
    mutation: update,
    update: true,
    toVariables: (patch) => ({
      id: '1',
      patch,
    }),
  });
};

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

  it('take a union on a create, and follow what it parses to', () => {
    expect(unionCalls).toBeTypeOf('function');
  });
});

type Children = {
  children: ReactNode;
};

type ServerProps = {
  values: z.input<typeof schema>;
};

const server = {
  title: 'Buy milk',
  priority: null,
  estimate: 3,
};

const wrapper = ({ children }: Children) =>
  createElement(
    QueryClientProvider,
    {
      client: new QueryClient(),
    },
    children,
  );

describe('useFormMutation', () => {
  it("clears a create's form on reset", () => {
    const { result } = renderHook(
      () =>
        useFormMutation({
          schema,
          mutation: create,
          defaultValues: {
            title: '',
          },
        }),
      {
        wrapper,
      },
    );

    act(() => {
      result.current.form.setValue('title', 'Buy milk', {
        shouldDirty: true,
      });
    });
    act(() => {
      result.current.form.reset();
    });

    expect(result.current.form.getValues('title')).toBe('');
  });

  it("keeps an update's edits when the server's values change", () => {
    const { result, rerender } = renderHook(
      ({ values }: ServerProps) =>
        useFormMutation({
          schema,
          mutation: update,
          update: true,
          values,
          toVariables: (patch) => ({
            id: '1',
            patch,
          }),
        }),
      {
        wrapper,
        initialProps: {
          values: server,
        },
      },
    );

    act(() => {
      result.current.form.setValue('title', 'Buy oat milk', {
        shouldDirty: true,
      });
    });
    rerender({
      values: {
        ...server,
        estimate: 5,
      },
    });

    expect(result.current.form.getValues()).toEqual({
      ...server,
      title: 'Buy oat milk',
      estimate: 5,
    });
  });

  it("sends a union's chosen branch, without what another left behind", async () => {
    const sent: ContactVariables[] = [];
    const { result } = renderHook(
      () =>
        useFormMutation({
          schema: contactSchema,
          mutation: {
            mutationKey: ['contacts', 'create'],
            mutationFn: async (contact: ContactVariables) => {
              sent.push(contact);
            },
          },
        }),
      {
        wrapper,
      },
    );

    act(() => {
      result.current.setValues({
        name: 'Sam',
        method: 'email',
        email: 'sam@example.com',
      });
    });
    act(() => {
      result.current.setValues({
        method: 'phone',
        phone: '555',
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => {
      expect(sent).toStrictEqual([
        {
          name: 'Sam',
          method: 'phone',
          phone: '555',
        },
      ]);
    });
  });

  it("shows a required field of a union's chosen branch on that field", async () => {
    const sent: ContactVariables[] = [];
    const { result } = renderHook(
      () => {
        const contact = useFormMutation({
          schema: contactSchema,
          mutation: {
            mutationKey: ['contacts', 'create'],
            mutationFn: async (variables: ContactVariables) => {
              sent.push(variables);
            },
          },
        });

        return {
          ...contact,
          errors: contact.form.formState.errors,
        };
      },
      {
        wrapper,
      },
    );

    act(() => {
      result.current.setValues({
        name: 'Sam',
        method: 'email',
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(result.current.errors).toHaveProperty('email.message', 'Required');
    expect(result.current.errors).not.toHaveProperty('phone');
    expect(sent).toStrictEqual([]);
  });
});
