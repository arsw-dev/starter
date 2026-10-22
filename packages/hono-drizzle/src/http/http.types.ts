import type { DB } from '#/db/db.ts';
import type {
  errorSchema,
  invalidSchema,
  issueSchema,
} from './http.schemas.ts';
import type { z } from '@hono/zod-openapi';

// The app, as every router and handler sees it. Its bindings are the Worker's
// own, which wrangler types adds to Cloudflare.Env
type AppEnv = {
  Bindings: Cloudflare.Env;
  Variables: {
    db: DB;
  };
};

// What an error sends, from the schemas the document describes it with
type ErrorBody = z.infer<typeof errorSchema>;
type Issue = z.infer<typeof issueSchema>;
type InvalidRequest = z.infer<typeof invalidSchema>;

export type { AppEnv, ErrorBody, InvalidRequest, Issue };
