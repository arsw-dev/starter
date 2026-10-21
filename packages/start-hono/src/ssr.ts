import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { ApiError } from './error.ts';

import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';

// Query's data, sent from the server with the page and taken up by the
// browser's QueryClient. Query redacts every error it sends; an ApiError
// carries only its status and issues, and the browser needs them to tell a 500
// from a 404
const setupSsr = (router: AnyRouter, queryClient: QueryClient) => {
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    dehydrateOptions: {
      shouldRedactErrors: (error) => !(error instanceof ApiError),
    },
  });
};

export { setupSsr };
