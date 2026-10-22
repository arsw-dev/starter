import { createApp } from '@arsw/hono-drizzle';

import { registerRoutes } from './app/app.ts';

const app = registerRoutes(
  createApp({
    db: (env) => env.DB,
  }),
);

export default app;
