import { z } from '@hono/zod-openapi';

import type { AppEnv, Policy } from './http.types.ts';
import type { Context } from 'hono';

// Where a route's paramPolicy reads its parameter, by defineRoute's names, and
// as the document names each
const PARAM_LOCATIONS = {
  params: 'path',
  query: 'query',
  headers: 'header',
  body: 'body',
} as const;

type ParamLocation = keyof typeof PARAM_LOCATIONS;

const isLocation = (key: string): key is ParamLocation =>
  Object.hasOwn(PARAM_LOCATIONS, key);

// The values a parameter can take, when they're string literals: an enum, a
// literal, or a union of them, optional or with a default. Anything else is
// never, so the parameter isn't one paramPolicy can name
type Literals<T> = [Exclude<T, undefined>] extends [infer V extends string]
  ? string extends V
    ? never
    : V
  : never;

// A request schema's parameters paramPolicy can name, each with its values:
// an object's own, or a discriminated union's discriminator, whose values its
// options give
type ValuesOf<Schema> =
  Schema extends z.ZodObject<infer Shape>
    ? {
        [
          Name in keyof Shape as [Literals<z.output<Shape[Name]>>] extends [
            never,
          ]
            ? never
            : Name
        ]: Literals<z.output<Shape[Name]>>;
      }
    : Schema extends z.ZodDiscriminatedUnion<
          readonly z.ZodType[],
          infer Discriminator
        >
      ? {
          [Name in Discriminator & keyof z.output<Schema>]: Literals<
            z.output<Schema>[Name]
          >;
        }
      : {};

// Exactly one of a record's keys, with its value: the others are never
type OneOf<Options> = {
  [Key in keyof Options]: {
    [Only in Key]: Options[Key];
  } & {
    [Other in Exclude<keyof Options, Key>]?: never;
  };
}[keyof Options];

// The policy for some of a parameter's values, by value
type Cases<Values extends string, Given> = {
  [Value in Values]?: Given;
};

type CasesOf<Schema, Given> = OneOf<{
  [Name in keyof ValuesOf<Schema>]: Cases<
    ValuesOf<Schema>[Name] & string,
    Given
  >;
}>;

// A route's paramPolicy: one location, one parameter of its schema there, and
// the policy for some of its values
type ParamPolicy<Params, Query, Headers, Body, Given> = OneOf<{
  params: CasesOf<Params, Given>;
  query: CasesOf<Query, Given>;
  headers: CasesOf<Headers, Given>;
  body: CasesOf<Body, Given>;
}>;

// A paramPolicy as the route keeps it: where, which parameter, the schemas it
// parses with (one, or a discriminated union's options' own), and the cases
type ByParam = {
  location: ParamLocation;
  name: string;
  schemas: z.ZodType[];
  cases: Record<string, Policy>;
};

// What paramPolicy reads its parameter with, from its location's schema
const schemasOf = (schema: z.ZodType | undefined, name: string) => {
  if (schema instanceof z.ZodObject) {
    const own = schema.shape[name];

    return own === undefined ? [] : [own];
  }

  if (
    schema instanceof z.ZodDiscriminatedUnion &&
    schema.def.discriminator === name
  ) {
    return schema.options.flatMap((option) =>
      option instanceof z.ZodObject && option.shape[name] !== undefined
        ? [option.shape[name]]
        : [],
    );
  }

  return [];
};

// A paramPolicy, checked and kept with the schemas it reads its parameter
// with. Its type allows one location and one parameter, with a schema: only a
// call past the types reaches the error
const toByParam = (
  given: Record<string, Record<string, Record<string, Policy>>>,
  schemas: Record<ParamLocation, z.ZodType | undefined>,
): ByParam => {
  const locations = Object.entries(given);
  const [location = '', byName = {}] = locations[0] ?? [];
  const names = Object.entries(byName);
  const [name = '', cases = {}] = names[0] ?? [];
  const parsers = isLocation(location)
    ? schemasOf(schemas[location], name)
    : [];

  if (
    !isLocation(location) ||
    locations.length !== 1 ||
    names.length !== 1 ||
    parsers.length === 0
  ) {
    throw new Error(
      "paramPolicy names exactly one parameter of one of the route's request schemas",
    );
  }

  return {
    location,
    name,
    schemas: parsers,
    cases,
  };
};

// Hono's validator reads a body only when it's sent as JSON, by this rule
const JSON_TYPE =
  /^application\/([a-z-.]+\+)?json(;\s*[a-zA-Z0-9-]+=([^;]+))*$/i;

// The parameter, raw, as the route's validator would read it. A body that
// isn't JSON, or isn't an object, has none. The body is cached, so the
// validator reads it again after this
const readParameter = async (
  c: Context<AppEnv>,
  location: ParamLocation,
  name: string,
): Promise<unknown> => {
  if (location === 'params') return c.req.param(name);

  // zod-validator maps each header to the schema's key whatever its case, as
  // c.req.header(name) reads it, so the policy and the handler see one value
  if (location === 'headers') return c.req.header(name);

  if (location === 'query') {
    const values = c.req.queries(name);

    return values?.length === 1 ? values[0] : values;
  }

  if (!JSON_TYPE.test(c.req.header('content-type') ?? '')) return undefined;

  try {
    const body: unknown = await c.req.json();

    return typeof body === 'object' &&
      body !== null &&
      Object.hasOwn(body, name)
      ? Reflect.get(body, name)
      : undefined;
  } catch {
    return undefined;
  }
};

// The policy for this request: its parameter's case, parsed with its own
// schema so a default applies, or the route's policy for any other value, a
// missing one, or one its schema refuses
const choosePolicy = async (
  c: Context<AppEnv>,
  { location, name, schemas, cases }: ByParam,
  policy: Policy,
) => {
  const raw = await readParameter(c, location, name);
  const value = schemas
    .map((schema) => schema.safeParse(raw))
    .find((result) => result.success)?.data;

  // By entry, not by index: a case's policy may be null, and a value may be
  // named like something every object has
  const chosen = Object.entries(cases).find(([given]) => given === value);

  return chosen ? chosen[1] : policy;
};

// What the document says of a paramPolicy, beside x-policy
const toDocumented = ({ location, name, cases }: ByParam) => ({
  in: PARAM_LOCATIONS[location],
  name,
  cases,
});

export { choosePolicy, toByParam, toDocumented };
export type { ByParam, ParamPolicy };
