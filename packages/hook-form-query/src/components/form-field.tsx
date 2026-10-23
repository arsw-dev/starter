import { createContext, use, useId } from 'react';
import { Controller } from 'react-hook-form';

import type { ComponentProps, ReactNode } from 'react';
import type {
  ControllerFieldState,
  ControllerProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

// The building blocks every field is made of, after shadcn's form: FormField
// binds a field, FormItem gives its parts one id, and the parts link the label,
// description and error to the control. None is styled: each takes the props
// of the element it renders

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
  'aria-describedby': string | undefined;
  'aria-invalid': boolean;
};

type FormControlProps = {
  // Whether a FormDescription is rendered: only ids that exist are named
  described?: boolean;
  children: (props: ControlProps) => ReactNode;
};

type FieldItemProps = {
  children: ReactNode;
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
    labelId: `${id}-label`,
    controlId: `${id}-control`,
    descriptionId: `${id}-description`,
    messageId: `${id}-message`,
  };
};

// The id without an element, for a field whose parts are its own components
const FieldItem = ({ children }: FieldItemProps) => {
  const id = useId();

  return <ItemContext value={id}>{children}</ItemContext>;
};

const FormItem = (props: ComponentProps<'div'>) => (
  <FieldItem>
    <div {...props} />
  </FieldItem>
);

const FormLabel = (props: ComponentProps<'label'>) => {
  const { labelId, controlId } = useFormField();

  return <label id={labelId} htmlFor={controlId} {...props} />;
};

// Hands its control the ids and state the other parts point at, where shadcn's
// Slot would put them on its child
const FormControl = ({ described = false, children }: FormControlProps) => {
  const { error, controlId, descriptionId, messageId } = useFormField();
  const describedBy = [described && descriptionId, error && messageId].filter(
    Boolean,
  );

  return children({
    id: controlId,
    'aria-describedby':
      describedBy.length > 0 ? describedBy.join(' ') : undefined,
    'aria-invalid': error !== undefined,
  });
};

const FormDescription = (props: ComponentProps<'p'>) => {
  const { descriptionId } = useFormField();

  return <p id={descriptionId} {...props} />;
};

// The field's error, or its children when there's none
const FormMessage = ({ children, ...props }: ComponentProps<'p'>) => {
  const { error, messageId } = useFormField();
  const body = error ? error.message : children;

  if (!body) {
    return null;
  }

  return (
    <p id={messageId} {...props}>
      {body}
    </p>
  );
};

export {
  FieldItem,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
export type { ControlProps };
