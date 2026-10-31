# Changelog

## 0.2.2

A select takes `onValueChange`, called with the value each time the user changes
it, on both engines. The field's `name` types the value: its options as text,
and `''` when it's cleared. A change a loading form ignores isn't reported.

## 0.2.1

Fixed: the Radix engine gives a select's `root` its `disabled` only when it's
true. Radix's own `Select.Root`, which types it as `boolean` alone before
`radix-ui` 1.8.0, was refused as the `root` under `exactOptionalPropertyTypes`,
and now passes as it is. A root that takes `undefined` too still does, and a
disabled field is still disabled.

## 0.2.0

Fields come from the app's own components: `createFormFactory` takes an engine
(`native` or `radix`) and the parts around every control, and makes each field
from the app's components for its control. The package renders no styles. The
Radix engine needs Radix Select 2.3.0 or later (`radix-ui` 1.5.0).

Fixed: a create form's `form.reset()` clears what was typed. Only an update
keeps the user's edits when its server values change.

Breaking: `FormInput`, `FormTextarea` and `FormSelect` are gone, made instead
with `createFormFactory`. A field's `className` goes to its control, not its
wrapper, whose class is `wrapperClassName`. Nothing is styled, so an app's
stylesheet no longer names the package as a Tailwind source. A loading form's
fields are no longer skeletons or read-only: they ignore changes until the
server's values arrive. A submitting form no longer pulses: `useFormActivity`
gives both states to an app's own parts. `useFormField` also gives a `labelId`,
which `FormLabel` sets; a consumer's own `id` on it still wins.

## 0.1.0

The first release: `zString`, `zNumber`, `zBoolean` and `zEnum`,
`useFormMutation`, `Form`, and native `FormInput`, `FormTextarea` and
`FormSelect` on their building blocks.
