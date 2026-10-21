import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

import { apiErrorAdapter } from './api/api.error.ts';

// A server function is an endpoint on the app's own origin: only the app's own
// pages may call it, so another site can't make a visitor's browser call it
// with their cookies. Pages themselves stay reachable from anywhere
const csrf = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
});

const startInstance = createStart(() => ({
  requestMiddleware: [csrf],
  serializationAdapters: [apiErrorAdapter],
}));

export { startInstance };
