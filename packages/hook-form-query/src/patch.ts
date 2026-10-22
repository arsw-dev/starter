import type { z } from 'zod';

// A form's schema: an object, so each field can be parsed on its own
type FieldsSchema<TOutput> = z.ZodType<TOutput> & {
  shape: Record<string, z.ZodType>;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Values as a schema gives them: primitives, dates, arrays and plain objects
const isEqual = (a: unknown, b: unknown): boolean => {
  // ===, where Object.is would tell -0 from 0
  if (a === b) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((item, index) => isEqual(item, b[index]))
    );
  }

  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);

    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => key in b && isEqual(a[key], b[key]))
    );
  }

  return false;
};

// What an update sends: each field the form changed from the server's, as the
// schema parses it. Both sides are parsed before comparing, so '3' in the form
// matches 3 from the server. A field undefined in the form is left as it is.
// A server field the schema rejects never matches, so bad data can still be
// fixed
const buildPatch = <TOutput>(
  schema: FieldsSchema<TOutput>,
  server: Record<string, unknown>,
  current: Record<string, unknown>,
): Partial<TOutput> => {
  const patch: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema.shape)) {
    const before = field.safeParse(server[key]);
    const after = field.safeParse(current[key]);

    if (after.success && after.data === undefined) {
      continue;
    }

    if (!after.success || !isEqual(before.data, after.data)) {
      patch[key] = after.success ? after.data : current[key];
    }
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built key by key from the schema's own fields
  return patch as Partial<TOutput>;
};

export { buildPatch, isEqual };
export type { FieldsSchema };
