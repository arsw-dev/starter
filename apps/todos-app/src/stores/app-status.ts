import { create } from 'zustand';

import type { ApiError } from '#/api/api.error.ts';

type AppStatus = {
  // A read that failed on todos-api's side: the page can't be trusted until
  // it's reloaded
  failure: ApiError | undefined;
  fail: (error: ApiError) => void;
};

// Set only in the browser: on the server, one store would be shared by every
// request
const useAppStatus = create<AppStatus>()((set) => ({
  failure: undefined,
  fail: (error) => {
    set({
      failure: error,
    });
  },
}));

export { useAppStatus };
