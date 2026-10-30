import { disabledWhen } from './disabled.ts';

import type { ControlAria } from '#/components/form-field.tsx';
import type { ControlArgs } from '#/engines/control.ts';
import type { ComponentType } from 'react';
import type { RefCallBack } from 'react-hook-form';

// What a checkbox or a switch is given. Both are buttons, which the label
// names and the form focuses
type CheckedBound<TChecked> = ControlAria & {
  name: string;
  checked: boolean;
  onCheckedChange: (checked: TChecked) => void;
  onBlur: () => void;
  ref: RefCallBack;
};

type CheckedPart<TChecked> = ComponentType<
  CheckedBound<TChecked> & {
    disabled?: boolean;
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
  const { disabled: ownDisabled, ...rest } = props;

  return (
    <Checkbox
      {...rest}
      {...aria}
      ref={ref}
      name={name}
      checked={value === true}
      {...disabledWhen(disabled || ownDisabled)}
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
  const { disabled: ownDisabled, ...rest } = props;

  return (
    <Switch
      {...rest}
      {...aria}
      ref={ref}
      name={name}
      checked={value === true}
      {...disabledWhen(disabled || ownDisabled)}
      onCheckedChange={onChange}
      onBlur={onBlur}
    />
  );
};

export { RadixCheckbox, RadixSwitch };
export type { RadixCheckboxSpec, RadixSwitchSpec };
