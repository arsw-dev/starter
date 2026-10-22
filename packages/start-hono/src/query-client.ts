import {
  QueryCache,
  QueryClient,
  environmentManager,
} from '@tanstack/react-query';

import { ApiError, isServerError } from './error.ts';

const RETRIES = 3;

// A refused request (4xx) fails the same way every time; anything else may
// pass on a later try. Never on the server, where a retry would hold the
// page's stream through the backoff
const retry = (failures: number, error: Error) => {
  if (environmentManager.isServer()) return false;
  if (error instanceof ApiError && error.status < 500) return false;

  return failures < RETRIES;
};

type Options = {
  // What the app shows for a read the API failed on its side, in the browser
  onServerError: (error: ApiError) => void;
};

// One per request on the server, one in the browser. Every page refetches
// what it shows (staleTime 0), but what's cached stays on screen meanwhile
// (gcTime), so moving between pages shows data, not skeletons
const createQueryClient = ({ onServerError }: Options) =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        retry,
      },
    },
    queryCache: new QueryCache({
      // A read the API failed leaves the page wrong, so the whole app says so.
      // A failed write is the page's to report: the mutation's own onError
      onError: (error) => {
        if (environmentManager.isServer() || !isServerError(error)) return;

        onServerError(error);
      },
    }),
  });

export { createQueryClient };
