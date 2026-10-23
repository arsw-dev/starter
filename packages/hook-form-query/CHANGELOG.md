# Changelog

## 0.2.0

Fields come from the app's own components: `createFormFactory` takes an engine
(`native` or `radix`) and the parts around every control, and makes each field
from the app's components for its control. The package renders no styles.

Breaking: `FormInput`, `FormTextarea` and `FormSelect` are gone, made instead
with `createFormFactory`. Nothing is styled, so an app's stylesheet no longer
names the package as a Tailwind source. A loading form's fields are no longer
skeletons, nor read-only, and a submitting form no longer pulses:
`useFormActivity` gives both states to an app's own parts. `useFormField` also
gives a `labelId`, which `FormLabel` sets.

## 0.1.0

The first release: `zString`, `zNumber`, `zBoolean` and `zEnum`,
`useFormMutation`, `Form`, and native `FormInput`, `FormTextarea` and
`FormSelect` on their building blocks.
