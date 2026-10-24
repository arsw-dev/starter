import { createFactory } from 'hono/factory';

import type { AppEnv } from './http.types.ts';

// Hono's createMiddleware, typed by the API's registered variables, so a
// middleware reads and sets them with no type arguments
const { createMiddleware } = createFactory<AppEnv>();

export { createMiddleware };
