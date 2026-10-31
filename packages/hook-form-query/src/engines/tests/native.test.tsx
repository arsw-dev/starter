import { screen, waitFor } from '@testing-library/react';
import { useFormContext } from 'react-hook-form';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createFormFactory } from '#/factory/create-form-factory.tsx';
import {
  Input,
  NativeCheckbox,
  NativeSelect,
  Textarea,
} from '#/tests/parts.tsx';
import {
  filled,
  priorities,
  renderForm,
  renderOwnForm,
} from '#/tests/render-form.tsx';

import type { Todo } from '#/tests/render-form.tsx';

const formFactory = createFormFactory({
  engine: 'native',
});

const FormInput = formFactory({
  control: 'input',
  parts: {
    input: Input,
  },
});

const FormTextarea = formFactory({
  control: 'textarea',
  parts: {
    textarea: Textarea,
  },
});

const FormSelect = formFactory({
  control: 'select',
  parts: {
    select: NativeSelect,
  },
});

const FormCheckbox = formFactory({
  control: 'checkbox',
  parts: {
    checkbox: NativeCheckbox,
  },
});

describe('a native input', () => {
  it("shows the form's value, and sends what's typed", async () => {
    const { sent, submit, user } = renderForm(
      <FormInput<Todo> name="estimate" label="Estimate" />,
      {
        ...filled,
        estimate: 3,
      },
    );
    const input = screen.getByRole('textbox', {
      name: 'Estimate',
    });

    expect(input).toHaveProperty('value', '3');

    await user.clear(input);
    await user.type(input, '5');
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          estimate: 5,
        },
      ]);
    });
  });
});

// Every control joins its own disabled with React Hook Form's
const fields = (disabled?: boolean) => (
  <>
    <FormInput<Todo> name="title" label="Title" disabled={disabled} />
    <FormTextarea<Todo> name="notes" label="Notes" disabled={disabled} />
    <FormSelect<Todo>
      name="priority"
      label="Priority"
      options={priorities}
      disabled={disabled}
    />
    <FormCheckbox<Todo> name="done" label="Done" disabled={disabled} />
  </>
);

const controls = () =>
  ['Title', 'Notes', 'Priority', 'Done'].map((name) =>
    screen.getByLabelText(name),
  );

describe('a native control', () => {
  it("is disabled by the field's props", () => {
    renderForm(fields(true));

    for (const control of controls()) {
      expect(control).toHaveProperty('disabled', true);
    }
  });

  it("is disabled by React Hook Form's", () => {
    renderOwnForm(fields(), {
      disabled: true,
    });

    for (const control of controls()) {
      expect(control).toHaveProperty('disabled', true);
    }
  });
});

describe('a native textarea', () => {
  it("sends what's typed", async () => {
    const { sent, submit, user } = renderForm(
      <FormTextarea<Todo> name="notes" label="Notes" />,
    );

    await user.type(
      screen.getByRole('textbox', {
        name: 'Notes',
      }),
      'Oat',
    );
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          notes: 'Oat',
        },
      ]);
    });
  });
});

describe('a native select', () => {
  it('leads with an empty option, labelled by the placeholder', () => {
    renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        placeholder="Default"
        options={priorities}
      />,
    );

    const options = screen.getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'Default',
      'Low',
      'High',
    ]);
    expect(options[0]).toHaveProperty('value', '');
  });

  it('has its empty option without a placeholder', () => {
    renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
      />,
    );

    expect(screen.getAllByRole('option')[0]).toHaveProperty('value', '');
  });

  it('sends the option picked, and clears through the empty one', async () => {
    const { sent, submit, user } = renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        placeholder="Default"
        options={priorities}
      />,
    );
    const select = screen.getByRole('combobox', {
      name: 'Priority',
    });

    await user.selectOptions(select, 'high');
    await submit();
    await user.selectOptions(select, '');
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          priority: 'high',
        },
        filled,
      ]);
    });
  });

  it('reports the option picked, and the empty one as empty', async () => {
    const onValueChange = vi.fn();
    const { user } = renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
        onValueChange={onValueChange}
      />,
    );
    const select = screen.getByRole('combobox', {
      name: 'Priority',
    });

    await user.selectOptions(select, 'high');
    await user.selectOptions(select, '');

    expect(onValueChange.mock.calls).toEqual([['high'], ['']]);
  });

  it('reports a value the form already holds', async () => {
    const held: unknown[] = [];

    const Holding = () => {
      const form = useFormContext<Todo>();

      return (
        <FormSelect<Todo>
          name="priority"
          label="Priority"
          options={priorities}
          onValueChange={() => {
            held.push(form.getValues('priority'));
          }}
        />
      );
    };

    const { user } = renderForm(<Holding />);

    await user.selectOptions(
      screen.getByRole('combobox', {
        name: 'Priority',
      }),
      'high',
    );

    expect(held).toEqual(['high']);
  });

  it('reports nothing of what a loading form ignores', async () => {
    const onValueChange = vi.fn();
    const { user } = renderOwnForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
        onValueChange={onValueChange}
      />,
      {
        isLoading: true,
      },
    );
    const select = screen.getByRole('combobox', {
      name: 'Priority',
    });

    await user.selectOptions(select, 'high');

    expect(select).toHaveProperty('value', '');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('a native checkbox', () => {
  it("is checked by the form's flag, and sends one", async () => {
    const { sent, submit, user } = renderForm(
      <FormCheckbox<Todo> name="done" label="Done" />,
      {
        ...filled,
        done: true,
      },
    );
    const checkbox = screen.getByRole('checkbox', {
      name: 'Done',
    });

    expect(checkbox).toHaveProperty('checked', true);

    await user.click(checkbox);
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          done: false,
        },
      ]);
    });
  });
});
