import { useRef } from 'react';

import { useFormActivity } from '#/components/form.tsx';

import type { ControlAria } from '#/components/form-field.tsx';
import type { ControlArgs, Option } from '#/engines/control.ts';
import type { ComponentType, ReactNode } from 'react';
import type { RefCallBack } from 'react-hook-form';

// What the trigger is given: it's the button the label names and the form
// focuses
type Bound = ControlAria & {
  ref: RefCallBack;
  onBlur: () => void;
  children: ReactNode;
};

type RadixSelectSpec = {
  parts: {
    root: ComponentType<{
      name: string;
      value: string;
      disabled?: boolean;
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
    // The factory narrows the value by the field's name
    onValueChange?: ((value: string) => void) | undefined;
  };
};

// The clearing item's value. Radix Select 2.3.0 and earlier throw on an item
// whose value is '', and '' is what shows the placeholder
const cleared = '@arsw/hook-form-query:cleared';

// Radix can report '' of its own, which would clear the field: on the form's
// native reset when it mounted empty, and in older versions as its options
// register. So a pick of the clearing item is the field's only way to ''.
// Closing the list leaves the field, as a native select's blur does, and the
// trigger's own blur counts only while the list is closed: opening it from
// the keyboard moves the focus into the list
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
  const { options, placeholder, onValueChange, ...rest } = props;
  const { isLoading } = useFormActivity();
  const isOpen = useRef(false);
  // Given only when it's true: Radix's Select.Root typed it as boolean alone
  // before radix-ui 1.8.0, which refuses an undefined under
  // exactOptionalPropertyTypes
  const disabledProp =
    disabled === true || rest.disabled === true
      ? {
          disabled: true,
        }
      : {};

  return (
    <Root
      name={name}
      value={value ?? ''}
      {...disabledProp}
      onValueChange={(picked) => {
        if (picked !== '') {
          const next = picked === cleared ? '' : picked;

          onChange(next);

          // A loading form ignored the change, so nothing changed to report
          if (!isLoading) {
            onValueChange?.(next);
          }
        }
      }}
      onOpenChange={(open) => {
        isOpen.current = open;

        if (!open) {
          onBlur();
        }
      }}
    >
      <Trigger
        {...rest}
        {...aria}
        ref={ref}
        onBlur={() => {
          if (!isOpen.current) {
            onBlur();
          }
        }}
      >
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
