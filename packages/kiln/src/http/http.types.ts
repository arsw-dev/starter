import type {
  errorSchema,
  invalidSchema,
  issueSchema,
} from './http.schemas.ts';
import type { z } from '@hono/zod-openapi';
import type {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
} from 'hono/utils/http-status';

// What an API declares once, for every router, route and middleware to read,
// by adding to it: declare module '@arsw/kiln' { interface Register { … } }.
// Its variables are every one a request carries
// oxlint-disable-next-line typescript/consistent-type-definitions -- an API adds to it, which needs declaration merging, which only an interface does
interface Register {}

// The variables an API registered: none unless it says so
type Variables = Register extends {
  variables: infer Registered extends object;
}
  ? Registered
  : {};

// An app's env with the variables given. Its bindings are the Worker's own,
// which wrangler types adds to Cloudflare.Env
type EnvWith<Vars extends object> = {
  Bindings: Cloudflare.Env;
  Variables: Vars;
};

// The app, as every router and handler sees it
type AppEnv = EnvWith<Variables>;

// The statuses an error body answers. A 422 has its issues too, and only the
// router's validation answers one
type ErrorStatus = Exclude<ClientErrorStatusCode | ServerErrorStatusCode, 422>;

// A route's or a middleware's errors: what each status means where it's
// declared ('Cannot find todo'), which an error class can't know
type ErrorDescriptions = Partial<Record<ErrorStatus, string>>;

// What an error sends, from the schemas the document describes it with
type ErrorBody = z.infer<typeof errorSchema>;
type Issue = z.infer<typeof issueSchema>;
type InvalidRequest = z.infer<typeof invalidSchema>;

export type {
  AppEnv,
  EnvWith,
  ErrorBody,
  ErrorDescriptions,
  ErrorStatus,
  InvalidRequest,
  Issue,
  Register,
  Variables,
};
