import { createApp, registerRoutes } from './app.ts';

const app = registerRoutes(createApp());

type AppType = typeof app;

export default app;
export type { AppType };
