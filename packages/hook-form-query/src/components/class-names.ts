// Classes joined, skipping any that are off
const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(' ');

// Every control's box: an input, a textarea, a select
const control =
  'rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none aria-invalid:border-red-500';

// The same box while the server's values load, in place of what it'll hold
const loading = 'animate-pulse bg-slate-100 text-transparent';

export { control, cx, loading };
