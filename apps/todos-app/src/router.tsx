import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { ApiError } from './api/api.error.ts';
import { createQueryClient } from './api/api.query-client.ts';
import { NotFound } from './components/not-found.tsx';
import { RouteError } from './components/route-error.tsx';
import { routeTree } from './routeTree.gen.ts';

import type { QueryClient } from '@tanstack/react-query';

type RouterContext = {
  queryClient: QueryClient;
};

const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
    } satisfies RouterContext,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
    defaultPreload: 'intent',
    // Query decides what's fresh, so a preload always asks it
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    // Query redacts every error it sends from the server; an ApiError carries
    // only a status, and the browser needs it to tell a 500 from a 404
    dehydrateOptions: {
      shouldRedactErrors: (error) => !(error instanceof ApiError),
    },
  });

  return router;
};

export { getRouter };
export type { RouterContext };
