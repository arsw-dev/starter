import { NativeCheckbox } from './native/checkbox.tsx';
import { NativeSelect } from './native/select.tsx';
import { NativeInput, NativeTextarea } from './native/text.tsx';
import { RadixCheckbox, RadixSwitch } from './radix/checked.tsx';
import { RadixRadioGroup } from './radix/radio-group.tsx';
import { RadixSelect } from './radix/select.tsx';

import type { Control, ControlSpec } from './control.ts';
import type { NativeCheckboxSpec } from './native/checkbox.tsx';
import type { NativeSelectSpec } from './native/select.tsx';
import type { InputSpec, TextareaSpec } from './native/text.tsx';
import type { RadixCheckboxSpec, RadixSwitchSpec } from './radix/checked.tsx';
import type { RadixRadioGroupSpec } from './radix/radio-group.tsx';
import type { RadixSelectSpec } from './radix/select.tsx';

// Each engine's controls. Radix has no text field, so its input and textarea
// are native
type Engines = {
  native: {
    input: InputSpec;
    textarea: TextareaSpec;
    select: NativeSelectSpec;
    checkbox: NativeCheckboxSpec;
  };
  radix: {
    input: InputSpec;
    textarea: TextareaSpec;
    select: RadixSelectSpec;
    checkbox: RadixCheckboxSpec;
    switch: RadixSwitchSpec;
    'radio-group': RadixRadioGroupSpec;
  };
};

const engines = {
  native: {
    input: NativeInput,
    textarea: NativeTextarea,
    select: NativeSelect,
    checkbox: NativeCheckbox,
  },
  radix: {
    input: NativeInput,
    textarea: NativeTextarea,
    select: RadixSelect,
    checkbox: RadixCheckbox,
    switch: RadixSwitch,
    'radio-group': RadixRadioGroup,
  },
} satisfies {
  [TEngine in keyof Engines]: {
    [
      TControl in keyof Engines[TEngine]
    ]: Engines[TEngine][TControl] extends ControlSpec
      ? Control<Engines[TEngine][TControl]>
      : never;
  };
};

export { engines };
export type { Engines };
