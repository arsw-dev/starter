# @arsw/hook-form-query

Forms on [React Hook Form](https://react-hook-form.com), [Zod](https://zod.dev)
and [TanStack Query](https://tanstack.com/query): schema helpers for what a form
gives, a hook that submits as a mutation, and field components.

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

Until the values arrive, `isLoading` holds the fields as skeletons and a submit
does nothing. `isDirty` follows the same comparison as the submit, and a field
the user has edited keeps their edit when the server's values change.

`formId` is the mutation key joined with dashes (`todos-update`), so a button
elsewhere on the page can submit the form (`<button form={formId}>`). One form
per mutation on a page: two would share the id.

## Components

```tsx
<Form id={formId} form={form} onSubmit={onSubmit} isSubmitting={isSubmitting}>
  <FormInput<CreateTodo> name="title" label="Title" />
  <FormSelect<CreateTodo>
    name="priority"
    label="Priority"
    options={[
      {
        value: 'high',
        label: 'High',
      },
    ]}
  />
</Form>
```

`FormTextarea` takes the same props as `FormInput`. Each field component takes
the form's type, and its `name` must be one of that type's fields: leaving the
type out doesn't compile. `FormField`, `FormItem`, `FormLabel`, `FormControl`,
`FormDescription` and `FormMessage` are the building blocks they're made of, for
a field none of them covers. The components use Tailwind classes, so an app's
stylesheet names the package as a source:
`@source '../node_modules/@arsw/hook-form-query';`.

## License

MIT
