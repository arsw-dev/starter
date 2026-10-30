# @arsw/hook-form-query

Forms on [React Hook Form](https://react-hook-form.com), [Zod](https://zod.dev)
and [TanStack Query](https://tanstack.com/query): schema helpers for what a form
gives, a hook that submits as a mutation, and a factory that makes fields from
an app's own components.

```sh
pnpm add @arsw/hook-form-query
```

Its peers: `react`, `react-hook-form`, `@hookform/resolvers`, `zod` and
`@tanstack/react-query`.

## Schemas

A form gives text, and an empty field is still a string. The helpers trim it and
decide what empty becomes, by `type`:

- `required`: an error ("Required"). Whitespace counts as empty.
- `optional`: `undefined`, so it's left out. On a create, the database's default
  applies.
- `nullable`: `null`. On an update, the field is cleared.

```ts
import { z } from 'zod';

import { zEnum, zNumber, zString } from '@arsw/hook-form-query';

const createTodoSchema = z.object({
  title: zString({
    type: 'required',
    refine: (string) => string.max(200),
  }),
  priority: zEnum({
    type: 'optional',
    values: ['low', 'medium', 'high'],
  }),
  estimate: zNumber({
    type: 'optional',
  }),
  dueDate: zString({
    type: 'optional',
    refine: (string, zod) => string.check(zod.iso.date()),
  }),
});

type CreateTodo = z.output<typeof createTodoSchema>;
```

`zString`'s `refine` builds on the trimmed string, and gets Zod as its second
argument. `zNumber` reads text in plain decimal notation as a number, and its
`refine` builds on that number (`(number) => number.int().min(1)`). `zBoolean`
reads `'true'` and `'false'` (it has no `nullable`), and `zEnum` checks its
values. Each also takes its own kind of value, as a server's values hold it. A
create and an update have separate schemas: the same empty field means "use the
default" in one and "clear it" in the other.

## `useFormMutation`

```tsx
const { form, formId, onSubmit, isSubmitting } = useFormMutation({
  schema: createTodoSchema,
  mutation: todosApi.create({
    onSuccess: () => {
      form.reset();
    },
  }),
});
```

It submits what the schema parses to through the mutation. Errors show on
submit, then as each field is left.

An update form takes the server's `values` (`undefined` while they load) and
sends only the fields that changed, comparing both sides once parsed:

```tsx
const todo = useQuery(todosApi.get({ id }));

const { form, formId, onSubmit, isLoading, isSubmitting, isDirty } =
  useFormMutation({
    schema: updateTodoSchema,
    mutation: todosApi.update(),
    values: todo.data,
    update: true,
    toVariables: (patch) => ({
      param: {
        id,
      },
      json: patch,
    }),
    onUnchanged: () => {
      // nothing to save
    },
  });

<Form
  id={formId}
  form={form}
  onSubmit={onSubmit}
  isLoading={isLoading}
  isSubmitting={isSubmitting}
>
  {/* the fields */}
</Form>;
```

Until the values arrive, `isLoading` is true, the fields take no input, and a
submit does nothing. `isDirty` follows the same comparison as the submit, and a
field the user has edited keeps their edit when the server's values change. Only
an update keeps edits: a create form's `form.reset()` clears what was typed.

`formId` is the mutation key joined with dashes (`todos-update`), so a button
elsewhere on the page can submit the form (`<button form={formId}>`). One form
per mutation on a page: two would share the id.

## Fields

`createFormFactory` makes a form's fields from the app's own components. The
package binds each one to the form and links its label, description and error to
the control. It renders no styles: how a field looks is its components'.

```tsx
import { createFormFactory } from '@arsw/hook-form-query';

const formFactory = createFormFactory({
  engine: 'radix',
  field: {
    wrapper: FieldWrapper,
    label: Label,
    description: FieldDescription,
    message: FieldMessage,
  },
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
    root: Select,
    trigger: SelectTrigger,
    value: SelectValue,
    content: SelectContent,
    item: SelectItem,
  },
});

<Form id={formId} form={form} onSubmit={onSubmit} isSubmitting={isSubmitting}>
  <FormInput<CreateTodo>
    name="title"
    label="Title"
    placeholder="What needs doing?"
  />
  <FormSelect<CreateTodo>
    name="priority"
    label="Priority"
    placeholder="Default"
    options={[
      {
        value: 'high',
        label: 'High',
      },
    ]}
  />
</Form>;
```

Make the factory and each field once, at module scope: each `formFactory` call
makes a new component, which would remount its field on every render.

Each field takes the form's type, and its `name` must be one of that type's
fields: leaving the type out doesn't compile. Every field takes a `label`, a
`description` and a `wrapperClassName`; a select takes `options` and a
`placeholder`, and a radio group `options`. Its other props, `className`
included, go to the control's main part: the input, the select's trigger, the
radio group's root.

### Engines and controls

The engine says how each control talks to the form: a native element's events,
or a Radix primitive's callbacks. Radix has no text field, so its `input` and
`textarea` are native.

| `control`     | `native` parts | `radix` parts                                 |
| ------------- | -------------- | --------------------------------------------- |
| `input`       | `input`        | `input`                                       |
| `textarea`    | `textarea`     | `textarea`                                    |
| `select`      | `select`       | `root`, `trigger`, `value`, `content`, `item` |
| `checkbox`    | `checkbox`     | `checkbox`                                    |
| `switch`      |                | `switch`                                      |
| `radio-group` |                | `root`, `item`, `label`, `option` (optional)  |

A part is checked against what the engine gives it, so a component that can't
take that doesn't compile. The check is by shape, not by kind: a radio group's
root would pass as a select's. And a part's own props must be optional, since
the check knows only what the engine gives it. Each part is given:

- **A control** (the input, the trigger, the checkbox): its value or `checked`,
  its change handler, `onBlur`, `ref`, `name`, and the `id`, `aria-describedby`
  and `aria-invalid` that link it to its label, description and error.
  `disabled` is the field's own, joined with React Hook Form's.
- **The field's parts**, each optional and a plain element unless given:
  `wrapper` its children and the field's `wrapperClassName` (as `className`),
  `label` an `id`, and `htmlFor` unless the control is a radio group,
  `description` and `message` an `id`.
- **A Radix select's** `content` renders its children as the list, and its
  `item` renders its children as the item's text, as shadcn's do. The
  `placeholder` shows while the field is empty and is also an item that clears
  it. It needs Radix Select 2.3.0 or later (`radix-ui` 1.5.0): before that, an
  empty field's hidden native select holds the first option's value.
- **A Radix select's** `root` is given `disabled` only when it's true, never as
  `false` or `undefined`. So Radix's own `Select.Root` can be passed as it is,
  under `exactOptionalPropertyTypes` too: before `radix-ui` 1.8.0, it types
  `disabled` as `boolean` alone.
- **A Radix radio group's** `item` and `label` are rendered for each option,
  inside `option` if it's given. The field's label names the group by id
  (`aria-labelledby`), with no `htmlFor`: a `div` isn't labelable.

A native select always leads with an empty option, labelled by the
`placeholder`: it's how a native select holds no value. So an option's value is
never `''`: empty is the placeholder's. A Radix select ignores a pick of `''`,
and a native one would show two empty options.

### State

A field sets nothing for looks: no classes, no `data-` attributes, no `disabled`
or `readOnly`. While the form loads, its control ignores changes, so an edit
can't be kept over the server's values once they arrive. A part reads what it
needs itself: `useFormActivity()` for `isLoading` and `isSubmitting`, and
`useFormField()` for the field's `error`.

```tsx
const Input = (props: ComponentProps<'input'>) => {
  const { isLoading } = useFormActivity();

  return (
    <input
      {...props}
      readOnly={isLoading}
      className={isLoading ? skeleton : box}
    />
  );
};
```

`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription` and
`FormMessage` are the unstyled building blocks the fields are made of, for a
field no control covers.

## License

MIT
