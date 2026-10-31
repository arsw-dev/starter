import { useFormActivity } from '#/components/form.tsx';

import type { ControlAria } from '#/components/form-field.tsx';
import type { ControlArgs, Option } from '#/engines/control.ts';
import type { ChangeEventHandler, ComponentType, ReactNode } from 'react';
import type { RefCallBack } from 'react-hook-form';

type Bound = ControlAria & {
  name: string;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  onBlur: () => void;
  ref: RefCallBack;
  children: ReactNode;
};

type NativeSelectSpec = {
  parts: {
    select: ComponentType<
      Bound & {
        disabled?: boolean | undefined;
      }
    >;
  };
  main: 'select';
  bound: Bound;
  props: {
    options: readonly Option[];
    // The empty option's label
    placeholder?: string | undefined;
    // The factory narrows the value by the field's name
    onValueChange?: ((value: string) => void) | undefined;
  };
};

// The empty option is always there: it's how a native select holds no value,
// where React would otherwise show the first option while the field is empty.
// Picking it sends '', which the schema reads as empty
const NativeSelect = ({
  parts,
  field,
  aria,
  props,
}: ControlArgs<NativeSelectSpec>) => {
  const { select: Select } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;
  const { options, placeholder, onValueChange, ...rest } = props;
  const { isLoading } = useFormActivity();

  return (
    <Select
      {...rest}
      {...aria}
      ref={ref}
      name={name}
      value={value ?? ''}
      disabled={disabled || rest.disabled}
      onChange={(event) => {
        onChange(event);

        // A loading form ignored the change, so nothing changed to report
        if (!isLoading) {
          onValueChange?.(event.target.value);
        }
      }}
      onBlur={onBlur}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
};

export { NativeSelect };
export type { NativeSelectSpec };
