import { createRouter } from '@tanstack/react-router';

import { createQueryClient, setupSsr } from '@arsw/start-hono';

import { NotFound } from './components/not-found.tsx';
import { RouteError } from './components/route-error.tsx';
import { routeTree } from './routeTree.gen.ts';
import { useAppStatus } from './stores/app-status.ts';

import type { QueryClient } from '@tanstack/react-query';

type RouterContext = {
  queryClient: QueryClient;
};

const getRouter = () => {
  const queryClient = createQueryClient({
    onServerError: (error) => {
      useAppStatus.getState().fail(error);
    },
  });

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

  setupSsr(router, queryClient);

  return router;
};

export { getRouter };
export type { RouterContext };
