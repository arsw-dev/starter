import { createServerOnlyFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { hc } from 'hono/client';

import type { AppType } from '@arsw/todos-api/client';

const api = createServerOnlyFn(() =>
  hc<AppType>('https://todos.api.internal', {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const response = await env.TODOS_API.fetch(request);

      // Never expected: logged here too, since a binding with no API behind it
      // answers without todos-api ever seeing the request
      if (response.status >= 500) {
        console.error(
          `todos-api answered ${response.status}: ${request.method} ${request.url}`,
        );
      }

      return response;
    },
  }),
);

// The client's type, for what a request takes: InferRequestType<…> on a route
type ApiClient = ReturnType<typeof api>;

export { api };
export type { ApiClient };
