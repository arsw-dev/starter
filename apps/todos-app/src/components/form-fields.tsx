import { createFormFactory, useFormField } from '@arsw/hook-form-query';

import type { ComponentProps } from 'react';

// The app's fields: @arsw/hook-form-query binds them to the form, and their
// looks are these parts'

// Classes joined, skipping any that are off
const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(' ');

// Every control's box: an input, a select
const control =
  'rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none aria-invalid:border-red-500';

const Wrapper = ({ className, ...props }: ComponentProps<'div'>) => (
  <div {...props} className={cx('flex flex-col gap-1', className)} />
);

const Label = (props: ComponentProps<'label'>) => {
  const { error } = useFormField();

  return (
    <label
      {...props}
      className={cx(
        'text-sm font-medium',
        error ? 'text-red-600' : 'text-slate-700',
      )}
    />
  );
};

const Description = (props: ComponentProps<'p'>) => (
  <p {...props} className="text-sm text-slate-500" />
);

const Message = (props: ComponentProps<'p'>) => (
  <p {...props} className="text-sm font-medium text-red-600" />
);

const Input = ({ className, ...props }: ComponentProps<'input'>) => (
  <input {...props} className={cx(control, className)} />
);

const Select = ({ className, ...props }: ComponentProps<'select'>) => (
  <select {...props} className={cx(control, className)} />
);

const formFactory = createFormFactory({
  engine: 'native',
  field: {
    wrapper: Wrapper,
    label: Label,
    description: Description,
    message: Message,
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
    select: Select,
  },
});

export { FormInput, FormSelect };
