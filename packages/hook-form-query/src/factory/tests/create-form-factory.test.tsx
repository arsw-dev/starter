import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Select } from 'radix-ui';
import { useFormContext } from 'react-hook-form';
import { describe, expect, it } from 'vite-plus/test';

import { Form } from '#/components/form.tsx';
import { createFormFactory } from '#/factory/create-form-factory.tsx';
import { Input, NativeSelect } from '#/tests/parts.tsx';
import { filled, renderForm, schema } from '#/tests/render-form.tsx';
import { useFormMutation } from '#/use-form-mutation.ts';

import type { FieldPartProps } from '#/factory/create-form-factory.tsx';
import type { Contact } from '#/tests/contact.ts';
import type { Todo } from '#/tests/render-form.tsx';
import type { ComponentProps } from 'react';
import type { FieldPath, FieldValues } from 'react-hook-form';
import type { z } from 'zod';

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
    wrapper: ({ className, children }: FieldPartProps['wrapper']) => (
      <section className={className}>{children}</section>
    ),
    label: ({ id, htmlFor, children }: FieldPartProps['label']) => (
      <label id={id} htmlFor={htmlFor} data-part="label">
        {children}
      </label>
    ),
    description: ({ id, children }: FieldPartProps['description']) => (
      <small id={id} data-part="description">
        {children}
      </small>
    ),
    message: ({ id, children }: FieldPartProps['message']) => (
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

type UpdateProps = {
  values: z.input<typeof schema> | undefined;
  sent: Partial<Todo>[];
};

// An update form, whose values arrive when the test rerenders it with them
const UpdateForm = ({ values, sent }: UpdateProps) => {
  const { form, onSubmit, isLoading } = useFormMutation({
    schema,
    update: true,
    values,
    mutation: {
      mutationKey: ['todos', 'update'],
      mutationFn: async (patch: Partial<Todo>) => {
        sent.push(patch);
      },
    },
  });

  return (
    <Form form={form} onSubmit={onSubmit} isLoading={isLoading}>
      <FormInput<Todo> name="title" label="Title" />
      <button type="submit">Save</button>
    </Form>
  );
};

// Fails the title as a server would, with no message
const ServerFailure = () => {
  const form = useFormContext<Todo>();

  return (
    <button
      type="button"
      onClick={() => {
        form.setError('title', {
          type: 'server',
        });
      }}
    >
      Fail
    </button>
  );
};

const empty = {
  ...filled,
  title: '',
};

// Each takes only the values its field's select can report
const onPriority = (value: 'low' | 'high' | '') => value;

const onEstimate = (value: `${number}` | '') => value;

const onMethod = (value: 'email' | 'phone' | 'none' | '') => value;

// A wrapper generic over the form, whose name is no literal
const GenericSelect = <TFormValues extends FieldValues>(props: {
  name: FieldPath<TFormValues>;
}) => <FormSelect<TFormValues> name={props.name} label="Pick" options={[]} />;

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

describe('a loading field', () => {
  it("takes no input until the server's values arrive", async () => {
    const user = userEvent.setup();
    const sent: Partial<Todo>[] = [];
    const client = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <UpdateForm values={undefined} sent={sent} />
      </QueryClientProvider>,
    );
    const input = screen.getByRole('textbox', {
      name: 'Title',
    });

    await user.type(input, 'Mine');

    expect(input).toHaveProperty('value', '');

    rerender(
      <QueryClientProvider client={client}>
        <UpdateForm values={filled} sent={sent} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(input).toHaveProperty('value', 'Buy milk');
    });

    await user.type(input, '!');
    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          title: 'Buy milk!',
        },
      ]);
    });
  });
});

describe("a field's ids", () => {
  it('describe the control only by what renders', async () => {
    const { user } = renderForm(
      <>
        <FormInput<Todo> name="title" label="Title" description={false} />
        <ServerFailure />
      </>,
    );
    const input = screen.getByRole('textbox', {
      name: 'Title',
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Fail',
      }),
    );

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(document.body.querySelector('p')).toBeNull();
  });
});

describe("a factory's field parts", () => {
  it('replace the plain ones, linked to the control as they are', async () => {
    const { submit } = renderForm(
      <MarkedInput<Todo>
        name="title"
        label="Title"
        description="Short"
        wrapperClassName="wrapper"
      />,
      empty,
    );

    await submit();

    const input = await screen.findByRole('textbox', {
      name: 'Title',
      description: 'Short Required',
    });

    expect(input.closest('section')?.className).toBe('wrapper');
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

  it("give a select's callback the values of the field it's named for", () => {
    const elements = [
      <FormSelect<Todo>
        key="priority"
        name="priority"
        label="Priority"
        options={[]}
        onValueChange={(value) => onPriority(value)}
      />,
      <FormSelect<Todo>
        key="estimate"
        name="estimate"
        label="Estimate"
        options={[]}
        onValueChange={(value) => onEstimate(value)}
      />,
      <FormSelect<Todo>
        key="string"
        name="priority"
        label="Priority"
        options={[]}
        onValueChange={(value: string) => value}
      />,
      <FormSelect<Todo>
        key="other"
        name="size"
        label="Size"
        options={[]}
        // @ts-expect-error size's values aren't priority's
        onValueChange={(value) => onPriority(value)}
      />,
      <FormSelect<Todo>
        key="empty"
        name="priority"
        label="Priority"
        options={[]}
        // @ts-expect-error the empty option reports ''
        onValueChange={(value: 'low' | 'high') => value}
      />,
      <FormInput<Todo>
        key="input"
        name="title"
        label="Title"
        // @ts-expect-error only a select reports its value
        onValueChange={() => undefined}
      />,
    ];

    expect(elements).toHaveLength(6);
  });

  it('take a name on any branch of a union, and none on no branch', () => {
    const elements = [
      <FormInput<Contact> key="shared" name="name" label="Name" />,
      <FormInput<Contact> key="email" name="email" label="Email" />,
      <FormInput<Contact> key="phone" name="phone" label="Phone" />,
      // @ts-expect-error on no branch
      <FormInput<Contact> key="fax" name="fax" label="Fax" />,
    ];

    expect(elements).toHaveLength(4);
  });

  it("give a select of a union's discriminator its values", () => {
    const elements = [
      <FormSelect<Contact>
        key="method"
        name="method"
        label="Method"
        options={[]}
        onValueChange={(value) => onMethod(value)}
      />,
      <FormSelect<Contact>
        key="narrow"
        name="method"
        label="Method"
        options={[]}
        // @ts-expect-error a method can be 'none' too, or empty
        onValueChange={(value: 'email' | 'phone') => value}
      />,
    ];

    expect(elements).toHaveLength(2);
  });

  it("take a select's name without a literal when it has no callback", () => {
    const name = 'priority' as FieldPath<Todo>;
    const elements = [
      <FormSelect<Todo> key="any" name={name} label="Any" options={[]} />,
      <GenericSelect<Todo> key="generic" name="priority" />,
    ];

    expect(elements).toHaveLength(2);
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
