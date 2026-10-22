import type app from './main.ts';

// Types only, so a front end can't import the API itself
type AppType = typeof app;

export type { AppType };
