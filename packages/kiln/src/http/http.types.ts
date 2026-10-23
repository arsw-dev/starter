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

// The app, as every router and handler sees it. Its bindings are the Worker's
// own, which wrangler types adds to Cloudflare.Env. Its variables are every one
// a request carries, as an API declares them: none unless it says so
type AppEnv<Variables extends object = {}> = {
  Bindings: Cloudflare.Env;
  Variables: Variables;
};

// The statuses an error body answers. A 422 has its issues too, and only the
// router's validation answers one
type ErrorStatus = Exclude<ClientErrorStatusCode | ServerErrorStatusCode, 422>;

// What an error sends, from the schemas the document describes it with
type ErrorBody = z.infer<typeof errorSchema>;
type Issue = z.infer<typeof issueSchema>;
type InvalidRequest = z.infer<typeof invalidSchema>;

export type { AppEnv, ErrorBody, ErrorStatus, InvalidRequest, Issue };
