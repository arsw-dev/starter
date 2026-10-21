import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import { AppFailure } from '#/components/app-failure.tsx';

import type { RouterContext } from '#/router.tsx';
import type { PropsWithChildren } from 'react';

const Document = ({ children }: PropsWithChildren) => {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <AppFailure />
        <TanStackDevtools
          plugins={[
            {
              name: 'Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: 'Query',
              render: <ReactQueryDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
};

const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Todos',
      },
    ],
  }),
  shellComponent: Document,
});

export { Route };
