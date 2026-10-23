import { Checkbox, Select } from 'radix-ui';

import type { ComponentProps, ReactNode } from 'react';

// Parts as an app would write them, unstyled: native elements, and Radix
// primitives composed as shadcn's are

type Children = {
  children: ReactNode;
};

const Input = (props: ComponentProps<'input'>) => <input {...props} />;

const Textarea = (props: ComponentProps<'textarea'>) => <textarea {...props} />;

const NativeSelect = (props: ComponentProps<'select'>) => <select {...props} />;

const NativeCheckbox = (props: ComponentProps<'input'>) => <input {...props} />;

const SelectContent = ({ children }: Children) => (
  <Select.Portal>
    <Select.Content>
      <Select.Viewport>{children}</Select.Viewport>
    </Select.Content>
  </Select.Portal>
);

const SelectItem = ({
  value,
  children,
}: Children & {
  value: string;
}) => (
  <Select.Item value={value}>
    <Select.ItemText>{children}</Select.ItemText>
  </Select.Item>
);

const RadixCheckbox = (props: ComponentProps<typeof Checkbox.Root>) => (
  <Checkbox.Root {...props}>
    <Checkbox.Indicator />
  </Checkbox.Root>
);

export {
  Input,
  NativeCheckbox,
  NativeSelect,
  RadixCheckbox,
  SelectContent,
  SelectItem,
  Textarea,
};
