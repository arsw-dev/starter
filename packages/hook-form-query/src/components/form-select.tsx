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

type Option = {
  value: string;
  label: string;
};

type FormSelectProps<TFormValues extends FieldValues> = Omit<
  ComponentProps<'select'>,
  'name' | 'value' | 'defaultValue' | 'children'
> & {
  // Never a source for TFormValues: TypeScript would otherwise read the form's
  // type back out of the name, and accept any name
  name: NoInfer<FieldPath<TFormValues>>;
  label: string;
  options: readonly Option[];
  // The empty option's label: picking it clears the field
  placeholder?: string;
  description?: string;
};

// As FormInput, for one of a fixed set. A native select's empty option is how
// it's cleared, so '' goes to the form like any other value. A Radix select
// differs: its hidden native select reports '' before its options register,
// so there onValueChange ignores '', and clearing needs a control of its own
const FormSelect = <TFormValues extends FieldValues = never>({
  name,
  label,
  options,
  placeholder = 'None',
  description,
  className,
  ...props
}: FormSelectProps<TFormValues>) => {
  const form = useFormContext<TFormValues>();
  const { isLoading } = useFormActivity();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {(controlProps) => (
              <select
                {...props}
                {...field}
                {...controlProps}
                className={cx(control, isLoading && loading)}
                value={field.value ?? ''}
                disabled={isLoading || props.disabled}
              >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export { FormSelect };
