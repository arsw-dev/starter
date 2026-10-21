import { createRouter } from '@tanstack/react-router';

import { NotFound } from './components/not-found.tsx';
import { routeTree } from './routeTree.gen.ts';

const getRouter = () =>
  createRouter({
    routeTree,
    defaultNotFoundComponent: NotFound,
    defaultPreload: 'intent',
    scrollRestoration: true,
  });

export { getRouter };
