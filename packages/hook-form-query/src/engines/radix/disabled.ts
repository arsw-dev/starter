// A part is given disabled only when it's true. Radix's own parts typed it as
// boolean alone before radix-ui 1.8.0, so under exactOptionalPropertyTypes an
// undefined one would refuse them as parts
const disabledWhen = (
  disabled: boolean | undefined,
): {
  disabled?: true;
} =>
  disabled === true
    ? {
        disabled: true,
      }
    : {};

export { disabledWhen };
