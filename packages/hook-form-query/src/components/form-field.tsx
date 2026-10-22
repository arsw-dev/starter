import { createContext, use, useId } from 'react';
import { Controller } from 'react-hook-form';

import { cx } from './class-names.ts';

import type { ComponentProps, ReactNode } from 'react';
import type {
  ControllerFieldState,
  ControllerProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

// The building blocks every field component is made of, after shadcn's form:
// FormField binds a field, FormItem gives its parts one id, and the parts link
// the label, description and error to the control

// What the parts read of a Controller's render arguments
type FieldContextValue = {
  field: {
    name: string;
  };
  fieldState: ControllerFieldState;
};

// What a control needs to be labelled and described
type ControlProps = {
  id: string;
  'aria-describedby': string;
  'aria-invalid': boolean;
};

type FormControlProps = {
  children: (props: ControlProps) => ReactNode;
};

const FieldContext = createContext<FieldContextValue | null>(null);

// The item's id, which its parts' ids are made from
const ItemContext = createContext<string | null>(null);

// The error comes from the Controller's own fieldState rather than formState,
// whose proxy only subscribes when it's read, which a memoized read may skip
const FormField = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  render,
  ...props
}: ControllerProps<TFieldValues, TName>) => (
  <Controller
    {...props}
    render={(args) => <FieldContext value={args}>{render(args)}</FieldContext>}
  />
);

const useFormField = () => {
  const field = use(FieldContext);
  const id = use(ItemContext);

  if (!field) {
    throw new Error('useFormField should be used within <FormField>');
  }

  if (!id) {
    throw new Error('useFormField should be used within <FormItem>');
  }

  return {
    name: field.field.name,
    error: field.fieldState.error,
    controlId: `${id}-control`,
    descriptionId: `${id}-description`,
    messageId: `${id}-message`,
  };
};

const FormItem = ({ className, ...props }: ComponentProps<'div'>) => {
  const id = useId();

  return (
    <ItemContext value={id}>
      <div className={cx('flex flex-col gap-1', className)} {...props} />
    </ItemContext>
  );
};

const FormLabel = ({ className, ...props }: ComponentProps<'label'>) => {
  const { error, controlId } = useFormField();

  return (
    <label
      className={cx(
        'text-sm font-medium text-slate-700',
        error && 'text-red-600',
        className,
      )}
      htmlFor={controlId}
      {...props}
    />
  );
};

// Hands its control the ids and state the other parts point at, where shadcn's
// Slot would put them on its child
const FormControl = ({ children }: FormControlProps) => {
  const { error, controlId, descriptionId, messageId } = useFormField();

  return children({
    id: controlId,
    'aria-describedby': error ? `${descriptionId} ${messageId}` : descriptionId,
    'aria-invalid': error !== undefined,
  });
};

const FormDescription = ({ className, ...props }: ComponentProps<'p'>) => {
  const { descriptionId } = useFormField();

  return (
    <p
      id={descriptionId}
      className={cx('text-sm text-slate-500', className)}
      {...props}
    />
  );
};

// The field's error, or its children when there's none
const FormMessage = ({
  className,
  children,
  ...props
}: ComponentProps<'p'>) => {
  const { error, messageId } = useFormField();
  const body = error ? error.message : children;

  if (!body) {
    return null;
  }

  return (
    <p
      id={messageId}
      className={cx('text-sm font-medium text-red-600', className)}
      {...props}
    >
      {body}
    </p>
  );
};

export {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
