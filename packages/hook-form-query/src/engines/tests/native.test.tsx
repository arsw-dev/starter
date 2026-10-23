import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { createFormFactory } from '#/factory/create-form-factory.tsx';
import {
  Input,
  NativeCheckbox,
  NativeSelect,
  Textarea,
} from '#/tests/parts.tsx';
import { filled, priorities, renderForm } from '#/tests/render-form.tsx';

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

  it("is disabled by the field's props", () => {
    renderForm(<FormInput<Todo> name="title" label="Title" disabled />);

    expect(
      screen.getByRole('textbox', {
        name: 'Title',
      }),
    ).toHaveProperty('disabled', true);
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
