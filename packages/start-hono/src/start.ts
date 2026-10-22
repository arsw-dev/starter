import { createCsrfMiddleware } from '@tanstack/react-start';

import { apiErrorAdapter } from './error.ts';

// Written out, so the declarations name only what react-start and
// react-router export
type StartOptions = {
  requestMiddleware: ReturnType<typeof createCsrfMiddleware>[];
  serializationAdapters: (typeof apiErrorAdapter)[];
};

// What createStart takes for an app that calls its API through server
// functions. A server function is an endpoint on the app's own origin: only the
// app's own pages may call it, so another site can't make a visitor's browser
// call it with their cookies. Pages themselves stay reachable from anywhere
const startOptions = (): StartOptions => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === 'serverFn',
    }),
  ],
  serializationAdapters: [apiErrorAdapter],
});

export { startOptions };
