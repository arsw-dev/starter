import { describe, expect, it } from 'vite-plus/test';

import { FormInput } from '#/components/form-input.tsx';
import { FormSelect } from '#/components/form-select.tsx';
import { FormTextarea } from '#/components/form-textarea.tsx';

type Todo = {
  title: string;
  priority: 'low' | 'high';
};

// What's checked is whether each element compiles: none is rendered
describe("a field's name", () => {
  it("is one of the form's fields", () => {
    const elements = [
      <FormInput<Todo> key="title" name="title" label="Title" />,
      // @ts-expect-error not one of Todo's fields
      <FormInput<Todo> key="typo" name="tilte" label="Title" />,
    ];

    expect(elements).toHaveLength(2);
  });

  it("can't be given without the form's type", () => {
    const elements = [
      // @ts-expect-error no form type, so no name is a field
      <FormInput key="input" name="title" label="Title" />,
      // @ts-expect-error as above
      <FormTextarea key="textarea" name="title" label="Title" />,
      // @ts-expect-error as above
      <FormSelect key="select" name="priority" label="Priority" options={[]} />,
    ];

    expect(elements).toHaveLength(3);
  });
});
