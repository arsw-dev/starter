import { screen } from '@testing-library/react';
import { Select } from 'radix-ui';
import { describe, expect, it } from 'vite-plus/test';

import { createFormFactory } from '#/factory/create-form-factory.tsx';
import { Input, NativeSelect } from '#/tests/parts.tsx';
import { filled, renderForm } from '#/tests/render-form.tsx';

import type { Todo } from '#/tests/render-form.tsx';
import type { ComponentProps, ReactNode } from 'react';

type Children = {
  children: ReactNode;
};

type Linked = Children & {
  id: string;
};

// A part whose value can't be a string, as a text input's can
type NumberProps = {
  value: number;
};

const NumberInput = (props: NumberProps) => props.value;

const formFactory = createFormFactory({
  engine: 'native',
});

const FormInput = formFactory({
  control: 'input',
  parts: {
    input: Input,
  },
});

const FormSelect = formFactory({
  control: 'select',
  parts: {
    select: NativeSelect,
  },
});

// A part of the consumer's with a prop of its own, as a library's variant is
const ToneInput = ({
  tone = 'quiet',
  ...props
}: ComponentProps<'input'> & {
  tone?: 'loud' | 'quiet';
}) => <input {...props} data-tone={tone} />;

const FormToneInput = formFactory({
  control: 'input',
  parts: {
    input: ToneInput,
  },
});

// Field parts of the consumer's, each marked so the test can find it
const marked = createFormFactory({
  engine: 'native',
  field: {
    wrapper: ({ children }: Children) => <section>{children}</section>,
    label: ({
      id,
      htmlFor,
      children,
    }: Linked & {
      htmlFor: string;
    }) => (
      <label id={id} htmlFor={htmlFor} data-part="label">
        {children}
      </label>
    ),
    description: ({ id, children }: Linked) => (
      <small id={id} data-part="description">
        {children}
      </small>
    ),
    message: ({ id, children }: Linked) => (
      <strong id={id} role="alert">
        {children}
      </strong>
    ),
  },
});

const MarkedInput = marked({
  control: 'input',
  parts: {
    input: Input,
  },
});

const empty = {
  ...filled,
  title: '',
};

describe('a field', () => {
  it('is named by its label', () => {
    renderForm(<FormInput<Todo> name="title" label="Title" />);

    expect(
      screen.getByRole('textbox', {
        name: 'Title',
      }),
    ).toBeInstanceOf(HTMLInputElement);
  });

  it('is described by its description, and only when it has one', () => {
    renderForm(
      <>
        <FormInput<Todo> name="estimate" label="Estimate" description="Hours" />
        <FormInput<Todo> name="title" label="Title" />
      </>,
    );

    expect(
      screen.getByRole('textbox', {
        name: 'Estimate',
        description: 'Hours',
      }),
    ).toBeDefined();
    expect(
      screen
        .getByRole('textbox', {
          name: 'Title',
        })
        .hasAttribute('aria-describedby'),
    ).toBe(false);
  });

  it('shows its error, marks the control invalid and focuses it', async () => {
    const { submit } = renderForm(
      <FormInput<Todo> name="title" label="Title" />,
      empty,
    );

    await submit();

    const input = await screen.findByRole('textbox', {
      name: 'Title',
      description: 'Required',
    });

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
  });

  it("gives its other props to the control's main part", () => {
    renderForm(
      <FormToneInput<Todo>
        name="title"
        label="Title"
        tone="loud"
        placeholder="What needs doing?"
      />,
    );

    const input = screen.getByRole('textbox', {
      name: 'Title',
    });

    expect(input.getAttribute('data-tone')).toBe('loud');
    expect(input.getAttribute('placeholder')).toBe('What needs doing?');
  });

  it('gives its className to the control and its wrapperClassName to the wrapper', () => {
    renderForm(
      <FormInput<Todo>
        name="title"
        label="Title"
        className="control"
        wrapperClassName="wrapper"
      />,
    );

    const input = screen.getByRole('textbox', {
      name: 'Title',
    });

    expect(input.className).toBe('control');
    expect(input.parentElement?.className).toBe('wrapper');
  });

  it('renders no styles of its own', async () => {
    const { submit } = renderForm(
      <FormInput<Todo> name="title" label="Title" description="Short" />,
      empty,
    );

    await submit();
    await screen.findByText('Required');

    expect(document.body.querySelector('[class], [style]')).toBeNull();
  });
});

describe("a factory's field parts", () => {
  it('replace the plain ones, linked to the control as they are', async () => {
    const { submit } = renderForm(
      <MarkedInput<Todo> name="title" label="Title" description="Short" />,
      empty,
    );

    await submit();

    const input = await screen.findByRole('textbox', {
      name: 'Title',
      description: 'Short Required',
    });

    expect(input.closest('section')).not.toBeNull();
    expect(screen.getByText('Title').dataset['part']).toBe('label');
    expect(screen.getByText('Short').dataset['part']).toBe('description');
    expect(screen.getByRole('alert').textContent).toBe('Required');
  });
});

// What's checked is whether each one compiles: none is rendered
describe('the types', () => {
  it("take a name only from the form's fields", () => {
    const elements = [
      <FormInput<Todo> key="title" name="title" label="Title" />,
      // @ts-expect-error not one of Todo's fields
      <FormInput<Todo> key="typo" name="tilte" label="Title" />,
      // @ts-expect-error no form type, so no name is a field
      <FormInput key="untyped" name="title" label="Title" />,
    ];

    expect(elements).toHaveLength(3);
  });

  it("take the main part's own props, but none the engine sets", () => {
    const elements = [
      // @ts-expect-error the field sets the value
      <FormInput<Todo> key="value" name="title" label="Title" value="Milk" />,
      <FormInput<Todo>
        key="change"
        name="title"
        label="Title"
        // @ts-expect-error the field sets the change handler
        onChange={() => undefined}
      />,
      <FormToneInput<Todo>
        key="tone"
        name="title"
        label="Title"
        // @ts-expect-error not one of ToneInput's tones
        tone="shout"
      />,
      // @ts-expect-error a select needs its options
      <FormSelect<Todo> key="options" name="priority" label="Priority" />,
    ];

    expect(elements).toHaveLength(4);
  });

  it('take only the controls an engine has, with the parts it needs', () => {
    const fields = [
      formFactory({
        // @ts-expect-error the native engine has no switch
        control: 'switch',
        parts: {
          input: Input,
        },
      }),
      formFactory({
        control: 'input',
        parts: {
          // @ts-expect-error a text input's value can be a string
          input: NumberInput,
        },
      }),
      createFormFactory({
        engine: 'radix',
      })({
        control: 'select',
        // @ts-expect-error a Radix select needs all its parts
        parts: {
          root: Select.Root,
        },
      }),
    ];

    expect(fields).toHaveLength(3);
  });
});
