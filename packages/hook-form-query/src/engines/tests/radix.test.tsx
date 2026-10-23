import { screen, waitFor } from '@testing-library/react';
import { Label, RadioGroup, Select, Switch } from 'radix-ui';
import { describe, expect, it } from 'vite-plus/test';

import { createFormFactory } from '#/factory/create-form-factory.tsx';
import { RadixCheckbox, SelectContent, SelectItem } from '#/tests/parts.tsx';
import { filled, priorities, renderForm, sizes } from '#/tests/render-form.tsx';

import type { Todo } from '#/tests/render-form.tsx';

const formFactory = createFormFactory({
  engine: 'radix',
});

const FormSelect = formFactory({
  control: 'select',
  parts: {
    root: Select.Root,
    trigger: Select.Trigger,
    value: Select.Value,
    content: SelectContent,
    item: SelectItem,
  },
});

const FormCheckbox = formFactory({
  control: 'checkbox',
  parts: {
    checkbox: RadixCheckbox,
  },
});

const FormSwitch = formFactory({
  control: 'switch',
  parts: {
    switch: Switch.Root,
  },
});

const FormRadioGroup = formFactory({
  control: 'radio-group',
  parts: {
    root: RadioGroup.Root,
    item: RadioGroup.Item,
    label: Label.Root,
  },
});

const unsized = {
  title: 'Buy milk',
};

const trigger = (name: string) =>
  screen.getByRole('combobox', {
    name,
  });

describe('a Radix select', () => {
  it('is named by its label, and shows the picked option', () => {
    renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
      />,
      {
        ...filled,
        priority: 'high',
      },
    );

    expect(trigger('Priority').textContent).toBe('High');
  });

  it('sends the option picked', async () => {
    const { sent, submit, user } = renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
      />,
    );

    await user.click(trigger('Priority'));
    await user.click(
      await screen.findByRole('option', {
        name: 'Low',
      }),
    );
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          priority: 'low',
        },
      ]);
    });
  });

  it('clears through its placeholder', async () => {
    const { sent, submit, user } = renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        placeholder="Default"
        options={priorities}
      />,
      {
        ...filled,
        priority: 'high',
      },
    );

    await user.click(trigger('Priority'));
    await user.click(
      await screen.findByRole('option', {
        name: 'Default',
      }),
    );
    await submit();

    expect(trigger('Priority').textContent).toBe('Default');
    await waitFor(() => {
      expect(sent).toEqual([filled]);
    });
  });

  it('has nothing to clear it without a placeholder', async () => {
    const { user } = renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
      />,
    );

    await user.click(trigger('Priority'));

    const options = await screen.findAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'Low',
      'High',
    ]);
  });

  // Radix resets to the value it mounted with, here ''
  it("keeps its value through the native form's reset", async () => {
    const { sent, submit, user } = renderForm(
      <FormSelect<Todo>
        name="priority"
        label="Priority"
        options={priorities}
      />,
    );

    await user.click(trigger('Priority'));
    await user.click(
      await screen.findByRole('option', {
        name: 'High',
      }),
    );
    trigger('Priority').closest('form')?.reset();
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          priority: 'high',
        },
      ]);
    });
  });

  it('takes the focus on an error, and checks again once picked', async () => {
    const { submit, user } = renderForm(
      <FormSelect<Todo> name="size" label="Size" options={sizes} />,
      unsized,
    );

    await submit();

    const invalid = await screen.findByRole('combobox', {
      name: 'Size',
      description: 'Required',
    });

    expect(document.activeElement).toBe(invalid);

    await user.click(invalid);
    await user.click(
      await screen.findByRole('option', {
        name: 'Large',
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Required')).toBeNull();
    });
  });
});

describe('a Radix checkbox', () => {
  it('is named by its label, and sends its flag', async () => {
    const { sent, submit, user } = renderForm(
      <FormCheckbox<Todo> name="done" label="Done" />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Done',
      }),
    );
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          done: true,
        },
      ]);
    });
  });
});

describe('a Radix switch', () => {
  it('is named by its label, and sends its flag', async () => {
    const { sent, submit, user } = renderForm(
      <FormSwitch<Todo> name="done" label="Done" />,
      {
        ...filled,
        done: true,
      },
    );

    await user.click(
      screen.getByRole('switch', {
        name: 'Done',
      }),
    );
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

describe('a Radix radio group', () => {
  it("is named by its label, and each radio by its option's", () => {
    renderForm(
      <FormRadioGroup<Todo> name="size" label="Size" options={sizes} />,
    );

    const group = screen.getByRole('radiogroup', {
      name: 'Size',
    });

    expect(
      screen.getByRole('radio', {
        name: 'Large',
      }).parentElement,
    ).toBe(group);
  });

  it('sends the radio picked', async () => {
    const { sent, submit, user } = renderForm(
      <FormRadioGroup<Todo> name="size" label="Size" options={sizes} />,
    );

    await user.click(
      screen.getByRole('radio', {
        name: 'Large',
      }),
    );
    await submit();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          ...filled,
          size: 'large',
        },
      ]);
    });
  });

  it('gives the focus on an error to its first radio', async () => {
    const { submit } = renderForm(
      <FormRadioGroup<Todo> name="size" label="Size" options={sizes} />,
      unsized,
    );

    await submit();
    await screen.findByText('Required');

    expect(document.activeElement).toBe(
      screen.getByRole('radio', {
        name: 'Small',
      }),
    );
  });
});
