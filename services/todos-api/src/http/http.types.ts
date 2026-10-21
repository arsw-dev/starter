import type {
  errorSchema,
  invalidSchema,
  issueSchema,
} from './http.schemas.ts';
import type { RouteConfig, RouteHandler, z } from '@hono/zod-openapi';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// The app, as every router and handler sees it
type AppEnv = {
  Bindings: Env;
  Variables: {
    db: DrizzleD1Database;
  };
};

type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppEnv>;

// What an error sends, from the schemas the document describes it with
type ErrorBody = z.infer<typeof errorSchema>;
type Issue = z.infer<typeof issueSchema>;
type InvalidRequest = z.infer<typeof invalidSchema>;

export type { AppEnv, AppRouteHandler, ErrorBody, Issue, InvalidRequest };
