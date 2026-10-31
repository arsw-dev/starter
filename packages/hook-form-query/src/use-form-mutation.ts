import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { buildPatch } from './patch.ts';
import { toSubmission } from './submission.ts';

import type { FieldsSchema } from './patch.ts';
import type { MutationKey, UseMutationOptions } from '@tanstack/react-query';
import type { BaseSyntheticEvent } from 'react';
import type {
  DefaultValues,
  FieldValues,
  Path,
  PathValue,
} from 'react-hook-form';
import type { z } from 'zod';

// A form's schema: anything that parses a form's values to an object, a union
// of objects included. Only an update needs the fields themselves
type FormSchema = z.ZodType<FieldValues, FieldValues>;

// What the form holds, and what it sends once the schema has parsed it
type Input<TSchema extends FormSchema> = z.input<TSchema>;

type Output<TSchema extends FormSchema> = z.output<TSchema>;

// The options defineApi's mutations give, with the key they always carry
type MutationFor<TData, TVariables> = UseMutationOptions<
  TData,
  Error,
  TVariables
> & {
  mutationKey: MutationKey;
};

type Shared<TSchema extends FormSchema> = {
  schema: TSchema;
  defaultValues?: DefaultValues<Input<TSchema>>;
  // Live values: the form follows them as they change
  values?: Input<TSchema> | undefined;
};

// What the mutation takes, when it isn't what the form sends: an update's id
// alongside its patch. What's sent comes from the schema alone, never inferred
// from the mutation
type Sending<TSent, TData, TVariables> =
  | {
      mutation: MutationFor<TData, TVariables>;
      toVariables: (data: NoInfer<TSent>) => TVariables;
    }
  | {
      mutation: MutationFor<TData, NoInfer<TSent>>;
      toVariables?: undefined;
    };

type CreateOptions<
  TSchema extends FormSchema,
  TData,
  TVariables,
> = Shared<TSchema> &
  Sending<Output<TSchema>, TData, TVariables> & {
    update?: false;
  };

// values are the server's: undefined while they load, and what a submit is
// compared against
type UpdateOptions<
  TSchema extends FormSchema,
  TData,
  TVariables,
> = Shared<TSchema> &
  Sending<Partial<Output<TSchema>>, TData, TVariables> & {
    update: true;
    // Compared field by field, so it has to be an object of them
    schema: FieldsSchema<FieldValues>;
    // A submit with nothing to send
    onUnchanged?: () => void;
  };

type Options<TSchema extends FormSchema, TData, TVariables> =
  | CreateOptions<TSchema, TData, TVariables>
  | UpdateOptions<TSchema, TData, TVariables>;

// A form that submits as a mutation: the schema parses it, a create sends what
// it parses to, and an update sends only what changed from the server's values
const useFormMutation = <TSchema extends FormSchema, TData, TVariables = never>(
  options: Options<TSchema, TData, TVariables>,
) => {
  const { schema, defaultValues, values } = options;

  // zodResolver's overloads can't match a schema that's still a type
  // parameter, so it's given the schema as what it is: the form's input to its
  // output
  const resolver = zodResolver(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the same schema, typed by its own input and output
    schema as unknown as z.ZodType<Output<TSchema>, Input<TSchema>>,
  );

  // Errors show on submit first, then as each field is left. When an update's
  // server values change, a field the user has edited keeps their edit. Only
  // an update's: React Hook Form applies resetOptions to every reset() too,
  // and a create's reset() is meant to clear what was typed
  const form = useForm<Input<TSchema>, unknown, Output<TSchema>>({
    resolver,
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    ...(options.update && {
      resetOptions: {
        keepDirtyValues: true,
      },
    }),
    ...(defaultValues && {
      defaultValues,
    }),
    ...(values && {
      values,
    }),
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Sending pairs each mutation with what onSubmit hands it
  const mutation = useMutation(options.mutation as MutationFor<TData, unknown>);
  const current = useWatch({
    control: form.control,
  });

  const formId = options.mutation.mutationKey.join('-');
  const isLoading = options.update === true && values === undefined;
  const isSubmitting = mutation.isPending || form.formState.isSubmitting;

  // An update's own: React Hook Form compares the raw values, where '3' and 3
  // differ
  const isDirty = options.update
    ? values !== undefined &&
      Object.keys(buildPatch(options.schema, values, current)).length > 0
    : form.formState.isDirty;

  const submit = form.handleSubmit((data) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Sending pairs toVariables with what this form sends: its output for a create, part of it for an update
    const toVariables = options.toVariables as
      | ((sent: unknown) => unknown)
      | undefined;
    const submission = toSubmission(
      options.update
        ? {
            update: true,
            schema: options.schema,
            data,
            current: form.getValues(),
            server: values,
            toVariables,
          }
        : {
            update: false,
            data,
            toVariables,
          },
    );

    if (submission.status === 'unchanged' && options.update) {
      options.onUnchanged?.();
    }

    if (submission.status === 'send') {
      mutation.mutate(submission.variables);
    }
  });

  // An update can't submit before the server's values arrive: there'd be
  // nothing to compare against, and its skeleton would show the schema's errors
  const onSubmit = async (event?: BaseSyntheticEvent) => {
    if (isLoading) {
      event?.preventDefault();

      return;
    }

    await submit(event);
  };

  const setValues = (next: Partial<Input<TSchema>>) => {
    for (const [name, value] of Object.entries(next)) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries loses the keys' type
      const path = name as Path<Input<TSchema>>;

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as above, for the value
      form.setValue(path, value as PathValue<Input<TSchema>, typeof path>, {
        shouldDirty: true,
      });
    }
  };

  return {
    form,
    formId,
    onSubmit,
    isDirty,
    isLoading,
    isSubmitting,
    setValues,
  };
};

export { useFormMutation };
