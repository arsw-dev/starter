import type { ControlProps } from '#/components/form-field.tsx';
import type { ControlArgs, Option } from '#/engines/control.ts';
import type { ChangeEventHandler, ComponentType, ReactNode } from 'react';
import type { RefCallBack } from 'react-hook-form';

type Bound = ControlProps & {
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
        disabled: boolean | undefined;
      }
    >;
  };
  main: 'select';
  bound: Bound;
  props: {
    options: readonly Option[];
    // The empty option's label
    placeholder?: string | undefined;
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
  const { options, placeholder, ...rest } = props;

  return (
    <Select
      {...rest}
      {...aria}
      ref={ref}
      name={name}
      value={value ?? ''}
      disabled={disabled || rest.disabled}
      onChange={onChange}
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
