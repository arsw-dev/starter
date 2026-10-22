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

type FormTextareaProps<TFormValues extends FieldValues> = Omit<
  ComponentProps<'textarea'>,
  'name' | 'value' | 'defaultValue' | 'children'
> & {
  // Never a source for TFormValues: TypeScript would otherwise read the form's
  // type back out of the name, and accept any name
  name: NoInfer<FieldPath<TFormValues>>;
  label: string;
  description?: string;
};

// As FormInput, over several lines
const FormTextarea = <TFormValues extends FieldValues = never>({
  name,
  label,
  description,
  className,
  ...props
}: FormTextareaProps<TFormValues>) => {
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
              <textarea
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

export { FormTextarea };
