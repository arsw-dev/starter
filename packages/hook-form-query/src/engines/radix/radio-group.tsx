import { Fragment } from 'react';

import { disabledWhen } from './disabled.ts';

import type { ControlAria } from '#/components/form-field.tsx';
import type { ControlArgs, Option } from '#/engines/control.ts';
import type { ComponentType, ReactNode } from 'react';
import type { RefCallBack } from 'react-hook-form';

// The group is a div, which a label can't name, so the field's label names it
// by id
type Bound = ControlAria & {
  'aria-labelledby': string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  ref: RefCallBack;
  children: ReactNode;
};

type RadixRadioGroupSpec = {
  parts: {
    root: ComponentType<
      Bound & {
        disabled?: boolean;
      }
    >;
    item: ComponentType<{
      id: string;
      value: string;
    }>;
    // Each option's own label
    label: ComponentType<{
      htmlFor: string;
      children: ReactNode;
    }>;
    // Holds an option's item and label: a fragment unless given
    option?: ComponentType<{
      children: ReactNode;
    }>;
  };
  main: 'root';
  bound: Bound;
  props: {
    options: readonly Option[];
  };
};

// The form's focus goes to the group, which hands it to its checked radio, or
// its first
const RadixRadioGroup = ({
  parts,
  field,
  aria,
  labelId,
  props,
}: ControlArgs<RadixRadioGroupSpec>) => {
  const {
    root: Root,
    item: Item,
    label: Label,
    option: Wrap = Fragment,
  } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;
  const { options, disabled: ownDisabled, ...rest } = props;

  return (
    <Root
      {...rest}
      {...aria}
      ref={ref}
      aria-labelledby={labelId}
      name={name}
      value={value ?? ''}
      {...disabledWhen(disabled || ownDisabled)}
      onValueChange={onChange}
      onBlur={onBlur}
    >
      {options.map((option, index) => {
        const id = `${aria.id}-${index}`;

        return (
          <Wrap key={option.value}>
            <Item id={id} value={option.value} />
            <Label htmlFor={id}>{option.label}</Label>
          </Wrap>
        );
      })}
    </Root>
  );
};

RadixRadioGroup.labelledById = true as const;

export { RadixRadioGroup };
export type { RadixRadioGroupSpec };
