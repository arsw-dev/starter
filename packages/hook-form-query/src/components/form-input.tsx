import { useFormContext } from 'react-hook-form';

import { control, cx, loading } from './class-names.ts';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form-field.tsx';
import { useFormActivity } from './form.tsx';

import type { ComponentProps } from 'react';
import type { FieldPath, FieldValues } from 'react-hook-form';

type FormInputProps<TFormValues extends FieldValues> = Omit<
  ComponentProps<'input'>,
  'name' | 'value' | 'defaultValue' | 'children'
> & {
  // Never a source for TFormValues: TypeScript would otherwise read the form's
  // type back out of the name, and accept any name
  name: NoInfer<FieldPath<TFormValues>>;
  label: string;
  description?: string;
};

// TFormValues has no usable default: without the form's type, no name is one
// of its fields, so leaving it out doesn't compile. The field's props come
// after the caller's, so they always win
const FormInput = <TFormValues extends FieldValues = never>({
  name,
  label,
  description,
  className,
  ...props
}: FormInputProps<TFormValues>) => {
  const form = useFormContext<TFormValues>();
  const { isLoading } = useFormActivity();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl described={description !== undefined}>
            {(controlProps) => (
              <input
                {...props}
                {...field}
                {...controlProps}
                className={cx(control, isLoading && loading)}
                value={field.value ?? ''}
                readOnly={isLoading || props.readOnly}
              />
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export { FormInput };
