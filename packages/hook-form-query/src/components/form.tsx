import { createContext, use } from 'react';
import { FormProvider } from 'react-hook-form';

import { cx } from './class-names.ts';

import type { ComponentProps } from 'react';
import type {
  FieldValues,
  UseFormHandleSubmit,
  UseFormReturn,
} from 'react-hook-form';

// What the form is doing, beyond React Hook Form's own state: loading the
// server's values, or submitting. A submit waits for the values, so it's never
// both
type Activity = 'idle' | 'loading' | 'submitting';

type FormProps<TInput extends FieldValues, TOutput extends FieldValues> = Omit<
  ComponentProps<'form'>,
  'onSubmit'
> & {
  form: UseFormReturn<TInput, unknown, TOutput>;
  onSubmit: ReturnType<UseFormHandleSubmit<TInput, TOutput>>;
  isLoading?: boolean;
  isSubmitting?: boolean;
};

const ActivityContext = createContext<Activity>('idle');

const useFormActivity = () => {
  const activity = use(ActivityContext);

  return {
    isLoading: activity === 'loading',
    isSubmitting: activity === 'submitting',
  };
};

const activityOf = (isLoading: boolean, isSubmitting: boolean): Activity => {
  if (isLoading) {
    return 'loading';
  }

  return isSubmitting ? 'submitting' : 'idle';
};

// The schema validates, so the browser's own checks stay off: they'd stop a
// submit before the schema's messages could show. A submitting form pulses
// rather than locking, as a sign to leave it be
const Form = <TInput extends FieldValues, TOutput extends FieldValues>({
  form,
  onSubmit,
  isLoading = false,
  isSubmitting = false,
  className,
  ...props
}: FormProps<TInput, TOutput>) => {
  const activity = activityOf(isLoading, isSubmitting);

  return (
    <FormProvider {...form}>
      <ActivityContext value={activity}>
        <form
          {...props}
          noValidate
          aria-busy={activity !== 'idle'}
          className={cx(isSubmitting && 'animate-pulse', className)}
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        />
      </ActivityContext>
    </FormProvider>
  );
};

export { Form, useFormActivity };
