import type { DB } from '#/db/db.ts';
import type {
  errorSchema,
  invalidSchema,
  issueSchema,
} from './http.schemas.ts';
import type { z } from '@hono/zod-openapi';

// The app, as every router and handler sees it. Its bindings are the Worker's
// own, which wrangler types adds to Cloudflare.Env. Its variables are every one
// a request carries: the database by default, or what an API declares, so one
// with no database, or with variables of its own, says so
type AppEnv<
  Variables extends object = {
    db: DB;
  },
> = {
  Bindings: Cloudflare.Env;
  Variables: Variables;
};

// What an error sends, from the schemas the document describes it with
type ErrorBody = z.infer<typeof errorSchema>;
type Issue = z.infer<typeof issueSchema>;
type InvalidRequest = z.infer<typeof invalidSchema>;

export type { AppEnv, ErrorBody, InvalidRequest, Issue };
