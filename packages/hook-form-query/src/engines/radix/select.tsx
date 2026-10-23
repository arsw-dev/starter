import type { ControlProps } from '#/components/form-field.tsx';
import type { ControlArgs, Option } from '#/engines/control.ts';
import type { ComponentType, ReactNode } from 'react';
import type { RefCallBack } from 'react-hook-form';

// What the trigger is given: it's the button the label names and the form
// focuses
type Bound = ControlProps & {
  ref: RefCallBack;
  onBlur: () => void;
  children: ReactNode;
};

type RadixSelectSpec = {
  parts: {
    root: ComponentType<{
      name: string;
      value: string;
      disabled: boolean | undefined;
      onValueChange: (value: string) => void;
      onOpenChange: (open: boolean) => void;
      children: ReactNode;
    }>;
    trigger: ComponentType<Bound>;
    value: ComponentType<{
      placeholder: ReactNode;
    }>;
    // Renders its children as the list, in a portal and viewport of its own
    content: ComponentType<{
      children: ReactNode;
    }>;
    // Renders its children as the item's text (Radix's ItemText)
    item: ComponentType<{
      value: string;
      children: ReactNode;
    }>;
  };
  main: 'trigger';
  bound: Bound;
  props: {
    options: readonly Option[];
    // Shown while the field is empty, and the label of the item that clears it
    placeholder?: string | undefined;
  };
};

// The clearing item's value. Radix Select before 2.4 throws on an item whose
// value is '', and '' is what shows the placeholder
const cleared = '@arsw/hook-form-query:cleared';

// Radix reports '' of its own, which would clear the field: before 2.4 while
// its options register, and on the form's native reset when it mounted empty.
// So a pick of the clearing item is the field's only way to ''. Picking closes
// the list, which leaves the field as a native select's blur does
const RadixSelect = ({
  parts,
  field,
  aria,
  props,
}: ControlArgs<RadixSelectSpec>) => {
  const {
    root: Root,
    trigger: Trigger,
    value: Value,
    content: Content,
    item: Item,
  } = parts;
  const { ref, name, value, disabled, onChange, onBlur } = field;
  const { options, placeholder, ...rest } = props;

  return (
    <Root
      name={name}
      value={value ?? ''}
      disabled={disabled}
      onValueChange={(picked) => {
        if (picked !== '') {
          onChange(picked === cleared ? '' : picked);
        }
      }}
      onOpenChange={(open) => {
        if (!open) {
          onBlur();
        }
      }}
    >
      <Trigger {...rest} {...aria} ref={ref} onBlur={onBlur}>
        <Value placeholder={placeholder} />
      </Trigger>
      <Content>
        {placeholder !== undefined && (
          <Item value={cleared}>{placeholder}</Item>
        )}
        {options.map((option) => (
          <Item key={option.value} value={option.value}>
            {option.label}
          </Item>
        ))}
      </Content>
    </Root>
  );
};

export { RadixSelect };
export type { RadixSelectSpec };
