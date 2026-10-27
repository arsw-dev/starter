import type {
  errorSchema,
  invalidSchema,
  issueSchema,
} from './http.schemas.ts';
import type { z } from '@hono/zod-openapi';

// What an API declares once, for every route and middleware to read, by adding
// to it: declare module '@arsw/kiln' { interface Register { … } }. Its
// variables are every one a request carries, and its policy is what every
// route says about who may call it
// oxlint-disable-next-line typescript/consistent-type-definitions -- an API adds to it, which needs declaration merging, which only an interface does
interface Register {}

// The variables an API registered: none unless it says so
type Variables = Register extends {
  variables: infer Registered extends object;
}
  ? Registered
  : {};

// Whether a value survives JSON as it is: a policy is written to the document.
// A property may be left out, which JSON does with an undefined one
type IsJson<Value> = Value extends string | number | boolean | null
  ? true
  : Value extends (...args: never) => unknown
    ? false
    : Value extends readonly (infer Item)[]
      ? IsJson<Item>
      : Value extends object
        ? {
            [Key in keyof Value]-?: IsJson<Exclude<Value[Key], undefined>>;
          }[keyof Value]
        : false;

// What a policy that isn't JSON becomes: a type no route can give, which says
// why
type PolicyNotJson = {
  'A registered policy is JSON: strings, numbers, booleans, null, and arrays and plain objects of those': never;
};

// The policy a registration gives, which only the API's enforce reads. Nothing
// registered, a route can't give one
type PolicyOf<Registered> = Registered extends {
  policy: infer Given;
}
  ? false extends IsJson<Given>
    ? PolicyNotJson
    : Given
  : never;

type Policy = PolicyOf<Register>;

// An app's env with the variables given. Its bindings are the Worker's own,
// which wrangler types adds to Cloudflare.Env
type EnvWith<Vars extends object> = {
  Bindings: Cloudflare.Env;
  Variables: Vars;
};

// The app, as every route and middleware sees it
type AppEnv = EnvWith<Variables>;

// What an error sends, from the schemas the document describes it with
type ErrorBody = z.infer<typeof errorSchema>;
type Issue = z.infer<typeof issueSchema>;
type InvalidRequest = z.infer<typeof invalidSchema>;

export type {
  AppEnv,
  EnvWith,
  ErrorBody,
  InvalidRequest,
  Issue,
  Policy,
  PolicyOf,
  Register,
  Variables,
};
