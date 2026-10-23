import type { ControlProps } from '#/components/form-field.tsx';
import type { ControlArgs } from '#/engines/control.ts';
import type { ChangeEventHandler, ComponentType } from 'react';
import type { RefCallBack } from 'react-hook-form';

// What a text control is given: an input's or a textarea's own value and
// events, so React Hook Form reads the event
type TextBound<TElement extends HTMLElement> = ControlProps & {
  name: string;
  value: string | number;
  onChange: ChangeEventHandler<TElement>;
  onBlur: () => void;
  ref: RefCallBack;
};

type TextPart<TElement extends HTMLElement> = ComponentType<
  TextBound<TElement> & {
    disabled: boolean | undefined;
  }
>;

type InputSpec = {
  parts: {
    input: TextPart<HTMLInputElement>;
  };
  main: 'input';
  bound: TextBound<HTMLInputElement>;
  props: object;
};

type TextareaSpec = {
  parts: {
    textarea: TextPart<HTMLTextAreaElement>;
  };
  main: 'textarea';
  bound: TextBound<HTMLTextAreaElement>;
  props: object;
};

// A field left empty is undefined, which would make the element uncontrolled
const NativeInput = ({ parts, field, aria, props }: ControlArgs<InputSpec>) => {
  const { input: Input } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;

  return (
    <Input
      {...props}
      {...aria}
      ref={ref}
      name={name}
      value={value ?? ''}
      disabled={disabled || props.disabled}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
};

const NativeTextarea = ({
  parts,
  field,
  aria,
  props,
}: ControlArgs<TextareaSpec>) => {
  const { textarea: Textarea } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;

  return (
    <Textarea
      {...props}
      {...aria}
      ref={ref}
      name={name}
      value={value ?? ''}
      disabled={disabled || props.disabled}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
};

export { NativeInput, NativeTextarea };
export type { InputSpec, TextareaSpec };
