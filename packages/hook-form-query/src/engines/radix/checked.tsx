import type { ControlProps } from '#/components/form-field.tsx';
import type { ControlArgs } from '#/engines/control.ts';
import type { ComponentType } from 'react';
import type { RefCallBack } from 'react-hook-form';

// What a checkbox or a switch is given. Both are buttons, which the label
// names and the form focuses
type CheckedBound<TChecked> = ControlProps & {
  name: string;
  checked: boolean;
  onCheckedChange: (checked: TChecked) => void;
  onBlur: () => void;
  ref: RefCallBack;
};

type CheckedPart<TChecked> = ComponentType<
  CheckedBound<TChecked> & {
    disabled: boolean | undefined;
  }
>;

type RadixCheckboxSpec = {
  parts: {
    checkbox: CheckedPart<boolean | 'indeterminate'>;
  };
  main: 'checkbox';
  bound: CheckedBound<boolean | 'indeterminate'>;
  props: object;
};

type RadixSwitchSpec = {
  parts: {
    switch: CheckedPart<boolean>;
  };
  main: 'switch';
  bound: CheckedBound<boolean>;
  props: object;
};

// A flag, so a checkbox's 'indeterminate' reads as unchecked: the form never
// sets it, and a schema's boolean couldn't hold it
const RadixCheckbox = ({
  parts,
  field,
  aria,
  props,
}: ControlArgs<RadixCheckboxSpec>) => {
  const { checkbox: Checkbox } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;

  return (
    <Checkbox
      {...props}
      {...aria}
      ref={ref}
      name={name}
      checked={value === true}
      disabled={disabled || props.disabled}
      onCheckedChange={(checked) => {
        onChange(checked === true);
      }}
      onBlur={onBlur}
    />
  );
};

const RadixSwitch = ({
  parts,
  field,
  aria,
  props,
}: ControlArgs<RadixSwitchSpec>) => {
  const { switch: Switch } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;

  return (
    <Switch
      {...props}
      {...aria}
      ref={ref}
      name={name}
      checked={value === true}
      disabled={disabled || props.disabled}
      onCheckedChange={onChange}
      onBlur={onBlur}
    />
  );
};

export { RadixCheckbox, RadixSwitch };
export type { RadixCheckboxSpec, RadixSwitchSpec };
