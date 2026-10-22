import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { buildPatch } from './patch.ts';

import type { FieldsSchema } from './patch.ts';
import type { MutationKey, UseMutationOptions } from '@tanstack/react-query';
import type {
  DefaultValues,
  FieldValues,
  Path,
  PathValue,
} from 'react-hook-form';
import type { z } from 'zod';

// The options defineApi's mutations give, with the key they always carry
type MutationFor<TData, TVariables> = UseMutationOptions<
  TData,
  Error,
  TVariables
> & {
  mutationKey: MutationKey;
};

type Shared<TInput extends FieldValues, TOutput extends FieldValues> = {
  schema: FieldsSchema<TOutput> & z.ZodType<TOutput, TInput>;
  defaultValues?: DefaultValues<TInput>;
  // Live values: the form follows them as they change
  values?: TInput | undefined;
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
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TData,
  TVariables,
> = Shared<TInput, TOutput> &
  Sending<TOutput, TData, TVariables> & {
    update?: false;
  };

// values are the server's: undefined while they load, and what a submit is
// compared against
type UpdateOptions<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TData,
  TVariables,
> = Shared<TInput, TOutput> &
  Sending<Partial<TOutput>, TData, TVariables> & {
    update: true;
    // A submit with nothing to send
    onUnchanged?: () => void;
  };

type Options<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TData,
  TVariables,
> =
  | CreateOptions<TInput, TOutput, TData, TVariables>
  | UpdateOptions<TInput, TOutput, TData, TVariables>;

// A form that submits as a mutation: the schema parses it, a create sends what
// it parses to, and an update sends only what changed from the server's values
const useFormMutation = <
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TData,
  TVariables = never,
>(
  options: Options<TInput, TOutput, TData, TVariables>,
) => {
  const { schema, defaultValues, values } = options;

  // Errors show on submit first, then as each field is left
  const form = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
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
      Object.keys(buildPatch(schema, values, current)).length > 0
    : form.formState.isDirty;

  const onSubmit = form.handleSubmit((data) => {
    if (!options.update) {
      mutation.mutate(options.toVariables ? options.toVariables(data) : data);

      return;
    }

    const patch = buildPatch(schema, values ?? {}, form.getValues());

    if (Object.keys(patch).length === 0) {
      options.onUnchanged?.();

      return;
    }

    mutation.mutate(options.toVariables ? options.toVariables(patch) : patch);
  });

  const setValues = (next: Partial<TInput>) => {
    for (const [name, value] of Object.entries(next)) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries loses the keys' type
      const path = name as Path<TInput>;

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as above, for the value
      form.setValue(path, value as PathValue<TInput, typeof path>, {
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
