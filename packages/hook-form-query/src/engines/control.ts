import type { ControlProps } from '#/components/form-field.tsx';
import type { ReactNode } from 'react';
import type { ControllerRenderProps, FieldValues } from 'react-hook-form';

// One of a select's or a radio group's fixed set
type Option = {
  value: string;
  label: string;
};

// What a control's parts are given by its engine, and how its field is used:
// - parts: what each part must accept, which the consumer's components are
//   checked against
// - main: the part the field's other props go to (the input, the trigger)
// - bound: what the engine sets on that part, so the field can't take it
// - props: the field's own props beyond name, label and description
type ControlSpec = {
  parts: object;
  main: string;
  bound: object;
  props: object;
};

// What an engine's control renders from. disabled is the one prop of the main
// part a control reads: it joins React Hook Form's own
type ControlArgs<TSpec extends ControlSpec> = {
  parts: TSpec['parts'];
  field: ControllerRenderProps<FieldValues, string>;
  aria: ControlProps;
  labelId: string;
  props: TSpec['props'] & {
    disabled?: boolean | undefined;
  };
};

type Control<TSpec extends ControlSpec> = (
  args: ControlArgs<TSpec>,
) => ReactNode;

export type { Control, ControlArgs, ControlSpec, Option };
