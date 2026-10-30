import { screen, waitFor } from '@testing-library/react';
import { Checkbox, Label, RadioGroup, Select, Switch } from 'radix-ui';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { createFormFactory } from '#/factory/create-form-factory.tsx';
import { RadixCheckbox, SelectContent, SelectItem } from '#/tests/parts.tsx';
import {
  filled,
  priorities,
  renderForm,
  renderOwnForm,
  sizes,
} from '#/tests/render-form.tsx';

import type { Todo } from '#/tests/render-form.tsx';
import type { ComponentProps } from 'react';

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

describe('a Radix select opened from the keyboard', () => {
  // Opening moves the focus into the list, which isn't leaving the field: it's
  // left, and so checked, once the list closes
  it('is checked only once its list closes', async () => {
    const { user } = renderOwnForm(
      <FormSelect<Todo> name="size" label="Size" options={sizes} />,
      {
        mode: 'onTouched',
        defaultValues: unsized,
      },
    );

    trigger('Size').focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');

    expect(screen.queryByText('Required')).toBeNull();

    await user.keyboard('{Escape}');

    expect(await screen.findByText('Required')).toBeDefined();
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
  it("is named and described by its field's, and each radio by its option's", () => {
    renderForm(
      <FormRadioGroup<Todo>
        name="size"
        label="Size"
        description="Pick one"
        options={sizes}
      />,
    );

    const group = screen.getByRole('radiogroup', {
      name: 'Size',
      description: 'Pick one',
    });

    // A div isn't labelable, so the field's label names it by id alone
    expect(screen.getByText('Size').hasAttribute('for')).toBe(false);

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

// Every control joins its own disabled with React Hook Form's
const fields = (disabled?: boolean) => (
  <>
    <FormSelect<Todo>
      name="priority"
      label="Priority"
      options={priorities}
      disabled={disabled}
    />
    <FormCheckbox<Todo> name="done" label="Done" disabled={disabled} />
    <FormSwitch<Todo> name="done" label="Finished" disabled={disabled} />
    <FormRadioGroup<Todo>
      name="size"
      label="Size"
      options={sizes}
      disabled={disabled}
    />
  </>
);

// What a disabled field leaves out of the form: each button, the radios, and
// the select's hidden native select
const controls = () => [
  trigger('Priority'),
  screen.getByRole('checkbox', {
    name: 'Done',
  }),
  screen.getByRole('switch', {
    name: 'Finished',
  }),
  ...screen.getAllByRole('radio'),
  ...document.body.querySelectorAll('select'),
];

describe('a Radix control', () => {
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

// A part's props with disabled typed as boolean alone, as Radix's own were
// before radix-ui 1.8.0: under exactOptionalPropertyTypes it takes no
// undefined
type StrictDisabled<TProps> = Omit<TProps, 'disabled'> & {
  disabled?: boolean;
};

// What each strict part was last given, by its control
const given = new Map<string, object>();

const StrictSelectRoot = (
  props: StrictDisabled<ComponentProps<typeof Select.Root>>,
) => {
  given.set('select', props);

  return <Select.Root {...props} />;
};

const StrictCheckbox = (
  props: StrictDisabled<ComponentProps<typeof Checkbox.Root>>,
) => {
  given.set('checkbox', props);

  return <Checkbox.Root {...props} />;
};

const StrictSwitch = (
  props: StrictDisabled<ComponentProps<typeof Switch.Root>>,
) => {
  given.set('switch', props);

  return <Switch.Root {...props} />;
};

const StrictRadioGroupRoot = (
  props: StrictDisabled<ComponentProps<typeof RadioGroup.Root>>,
) => {
  given.set('radio-group', props);

  return <RadioGroup.Root {...props} />;
};

// That each of these compiles is the type test: a part whose disabled takes no
// undefined is still one the engine can render
const StrictFormSelect = formFactory({
  control: 'select',
  parts: {
    root: StrictSelectRoot,
    trigger: Select.Trigger,
    value: Select.Value,
    content: SelectContent,
    item: SelectItem,
  },
});

const StrictFormCheckbox = formFactory({
  control: 'checkbox',
  parts: {
    checkbox: StrictCheckbox,
  },
});

const StrictFormSwitch = formFactory({
  control: 'switch',
  parts: {
    switch: StrictSwitch,
  },
});

const StrictFormRadioGroup = formFactory({
  control: 'radio-group',
  parts: {
    root: StrictRadioGroupRoot,
    item: RadioGroup.Item,
    label: Label.Root,
  },
});

type Own = {
  disabled?: boolean;
};

const strictFields = (own: Own = {}) => (
  <>
    <StrictFormSelect<Todo>
      name="priority"
      label="Priority"
      options={priorities}
      {...own}
    />
    <StrictFormCheckbox<Todo> name="done" label="Done" {...own} />
    <StrictFormSwitch<Todo> name="done" label="Finished" {...own} />
    <StrictFormRadioGroup<Todo>
      name="size"
      label="Size"
      options={sizes}
      {...own}
    />
  </>
);

describe('a Radix part whose disabled is boolean alone', () => {
  beforeEach(() => {
    given.clear();
  });

  it("is given disabled by the field's props", () => {
    renderForm(
      strictFields({
        disabled: true,
      }),
    );

    expect([...given.values()]).toHaveLength(4);
    for (const props of given.values()) {
      expect(props).toHaveProperty('disabled', true);
    }

    for (const control of controls()) {
      expect(control).toHaveProperty('disabled', true);
    }
  });

  it("is given disabled by React Hook Form's", () => {
    renderOwnForm(strictFields(), {
      disabled: true,
    });

    expect([...given.values()]).toHaveLength(4);
    for (const props of given.values()) {
      expect(props).toHaveProperty('disabled', true);
    }

    for (const control of controls()) {
      expect(control).toHaveProperty('disabled', true);
    }
  });

  it('is given no disabled at all while its field is enabled', () => {
    renderForm(strictFields());

    expect([...given.values()]).toHaveLength(4);
    for (const props of given.values()) {
      expect(Object.hasOwn(props, 'disabled')).toBe(false);
    }

    for (const control of controls()) {
      expect(control.hasAttribute('disabled')).toBe(false);
    }
  });
});
