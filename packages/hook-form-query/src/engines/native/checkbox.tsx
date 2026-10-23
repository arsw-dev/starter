import type { ControlAria } from '#/components/form-field.tsx';
import type { ControlArgs } from '#/engines/control.ts';
import type { ChangeEventHandler, ComponentType } from 'react';
import type { RefCallBack } from 'react-hook-form';

type Bound = ControlAria & {
  type: 'checkbox';
  name: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur: () => void;
  ref: RefCallBack;
};

type NativeCheckboxSpec = {
  parts: {
    checkbox: ComponentType<
      Bound & {
        disabled?: boolean | undefined;
      }
    >;
  };
  main: 'checkbox';
  bound: Bound;
  props: object;
};

// A flag: the form holds true or false, never the input's value attribute
const NativeCheckbox = ({
  parts,
  field,
  aria,
  props,
}: ControlArgs<NativeCheckboxSpec>) => {
  const { checkbox: Checkbox } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;

  return (
    <Checkbox
      {...props}
      {...aria}
      ref={ref}
      type="checkbox"
      name={name}
      checked={value === true}
      disabled={disabled || props.disabled}
      onChange={(event) => {
        onChange(event.target.checked);
      }}
      onBlur={onBlur}
    />
  );
};

export { NativeCheckbox };
export type { NativeCheckboxSpec };
