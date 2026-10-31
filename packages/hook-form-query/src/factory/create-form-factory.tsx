import { useFormContext } from 'react-hook-form';

import {
  FieldItem,
  FormControl,
  FormField,
  useFormField,
} from '#/components/form-field.tsx';
import { useFormActivity } from '#/components/form.tsx';
import { engines } from '#/engines/engines.ts';

import type { ControlAria } from '#/components/form-field.tsx';
import type { Control, ControlArgs, ControlSpec } from '#/engines/control.ts';
import type { Engines } from '#/engines/engines.ts';
import type { ComponentType, ReactNode } from 'react';
import type { FieldPath, FieldPathValue, FieldValues } from 'react-hook-form';

type Engine = keyof Engines;

type Children = {
  children: ReactNode;
};

// A part the control is linked to by its id
type Linked = Children & {
  id: string;
};

// No htmlFor when the control isn't labelable: a radio group's label names it
// by id
type Labelling = Linked & {
  htmlFor?: string | undefined;
};

// The wrapper's class comes from the field, as the control's does
type Wrapping = Children & {
  className?: string | undefined;
};

// The parts around every control of a factory's fields, each given the ids
// that link it to the control. A plain element unless given
type FieldPartProps = {
  wrapper: Wrapping;
  label: Labelling;
  description: Linked;
  message: Linked;
};

type FieldParts = {
  [TPart in keyof FieldPartProps]?: ComponentType<FieldPartProps[TPart]>;
};

type FactoryOptions<TEngine extends Engine> = {
  engine: TEngine;
  field?: FieldParts;
};

type SpecOf<
  TEngine extends Engine,
  TControl extends keyof Engines[TEngine],
> = Engines[TEngine][TControl] extends ControlSpec
  ? Engines[TEngine][TControl]
  : never;

type ControlOptions<TControl, TParts> = {
  control: TControl;
  parts: TParts;
};

// What every field takes, whatever its control
type FieldProps<TFormValues extends FieldValues> = {
  // Never a source for TFormValues: TypeScript would otherwise read the form's
  // type back out of the name, and accept any name
  name: NoInfer<FieldPath<TFormValues>>;
  label: ReactNode;
  description?: ReactNode;
  // The field's className is its control's, so the wrapper has its own
  wrapperClassName?: string | undefined;
};

type PropsOf<TPart> =
  TPart extends ComponentType<infer TProps> ? TProps : never;

// The main part's own props, less what the engine sets on it and what the
// field takes for itself. A default would make the part uncontrolled
type Passthrough<TSpec extends ControlSpec, TParts> = Omit<
  PropsOf<TParts[TSpec['main'] & keyof TParts]>,
  | keyof TSpec['bound']
  | keyof TSpec['props']
  | keyof FieldProps<FieldValues>
  | 'defaultValue'
  | 'defaultChecked'
>;

// What a change reports is the option's value before the schema parses it:
// always text, and '' from the empty option, whatever the form's field holds
type Reported<TValue> = TValue extends string | number | boolean
  ? `${TValue}` | ''
  : string;

// One member per name, so a field's name decides what its callback is given:
// TypeScript can't infer a second type argument once the form's is written. A
// field with no callback needs no literal name, as a wrapper generic over the
// form has none, and with no form type at all there'd be no members
type ValueChange<TFormValues extends FieldValues> =
  | {
      onValueChange?: undefined;
    }
  | {
      [TName in FieldPath<TFormValues>]: {
        name: NoInfer<TName>;
        onValueChange?:
          | ((
              value: Reported<NonNullable<FieldPathValue<TFormValues, TName>>>,
            ) => void)
          | undefined;
      };
    }[FieldPath<TFormValues>];

// A control whose spec takes onValueChange has it typed by the field's name
type OwnProps<
  TSpec extends ControlSpec,
  TFormValues extends FieldValues,
> = 'onValueChange' extends keyof TSpec['props']
  ? Omit<TSpec['props'], 'onValueChange'> & ValueChange<TFormValues>
  : TSpec['props'];

// TFormValues has no usable default: without the form's type, no name is one
// of its fields, so leaving it out doesn't compile
type FieldComponent<TSpec extends ControlSpec, TParts> = <
  TFormValues extends FieldValues = never,
>(
  props: FieldProps<TFormValues> &
    OwnProps<TSpec, TFormValues> &
    Passthrough<TSpec, TParts>,
) => ReactNode;

type BodyProps = {
  parts: Required<FieldParts>;
  label: ReactNode;
  description: ReactNode;
  wrapperClassName: string | undefined;
  labelledById: boolean;
  children: (aria: ControlAria, labelId: string) => ReactNode;
};

type RuntimeProps = FieldProps<FieldValues> & ControlArgs<ControlSpec>['props'];

// A description of false, null or '' (a condition's) renders nothing, so the
// control isn't described by it
const isShown = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== '';

// While the server's values load, a control takes no input: an edit then
// would be kept over the values once they arrive. Controls are controlled, so
// ignoring the change is enough, with nothing set on the control
const ignore = () => undefined;

// The parts a factory isn't given: plain elements
const plain: Required<FieldParts> = {
  wrapper: ({ className, children }: Wrapping) => (
    <div className={className}>{children}</div>
  ),
  label: ({ id, htmlFor, children }: Labelling) => (
    <label id={id} htmlFor={htmlFor}>
      {children}
    </label>
  ),
  description: ({ id, children }: Linked) => <p id={id}>{children}</p>,
  message: ({ id, children }: Linked) => <p id={id}>{children}</p>,
};

// A field's label, description and error around its control, all linked
const Body = ({
  parts,
  label,
  description,
  wrapperClassName,
  labelledById,
  children,
}: BodyProps) => {
  const {
    wrapper: Wrapper,
    label: Label,
    description: Description,
    message: Message,
  } = parts;
  const { error, labelId, controlId, descriptionId, messageId } =
    useFormField();

  return (
    <Wrapper className={wrapperClassName}>
      <Label id={labelId} htmlFor={labelledById ? undefined : controlId}>
        {label}
      </Label>
      <FormControl described={isShown(description)}>
        {(aria) => children(aria, labelId)}
      </FormControl>
      {isShown(description) && (
        <Description id={descriptionId}>{description}</Description>
      )}
      {error?.message ? (
        <Message id={messageId}>{error.message}</Message>
      ) : null}
    </Wrapper>
  );
};

// Fields from one engine's controls, around the consumer's own components. The
// package renders no styles: every part is the consumer's, or a plain element
const createFormFactory = <TEngine extends Engine>({
  engine,
  field: fieldParts = {},
}: FactoryOptions<TEngine>) => {
  const shared = {
    ...plain,
    ...fieldParts,
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- engines pairs each control with its spec, which a lookup through the factory's type parameters can't follow
  const controls = engines[engine] as unknown as Record<
    keyof Engines[TEngine],
    Control<ControlSpec>
  >;

  return <
    TControl extends keyof Engines[TEngine],
    TParts extends SpecOf<TEngine, TControl>['parts'],
  >({
    control,
    parts,
  }: ControlOptions<TControl, TParts>) => {
    const EngineControl: Control<ControlSpec> = controls[control];

    const Field = ({
      name,
      label,
      description,
      wrapperClassName,
      ...props
    }: RuntimeProps) => {
      const form = useFormContext();
      const { isLoading } = useFormActivity();

      return (
        <FormField
          control={form.control}
          name={name}
          render={({ field }) => (
            <FieldItem>
              <Body
                parts={shared}
                label={label}
                description={description}
                wrapperClassName={wrapperClassName}
                labelledById={EngineControl.labelledById === true}
              >
                {(aria, labelId) => (
                  <EngineControl
                    parts={parts}
                    field={
                      isLoading
                        ? {
                            ...field,
                            onChange: ignore,
                          }
                        : field
                    }
                    aria={aria}
                    labelId={labelId}
                    props={props}
                  />
                )}
              </Body>
            </FieldItem>
          )}
        />
      );
    };

    // One name per control in React's devtools, where each would be Field
    Field.displayName = `FormField(${String(control)})`;

    return Field as FieldComponent<SpecOf<TEngine, TControl>, TParts>;
  };
};

export { createFormFactory };
export type { FieldPartProps, FieldParts };
