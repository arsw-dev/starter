import { useEffect } from 'react';

import { isServerError } from '#/api/api.error.ts';
import { useAppStatus } from '#/stores/app-status.ts';

import type { ErrorComponentProps } from '@tanstack/react-router';

// What a route shows when it throws. A failure on todos-api's side is the
// app's failure, said once over the whole page, so the route shows nothing
// of its own
const RouteError = ({ error }: ErrorComponentProps) => {
  useEffect(() => {
    if (isServerError(error)) useAppStatus.getState().fail(error);
  }, [error]);

  if (isServerError(error)) return null;

  return (
    <div
      className="mx-auto flex max-w-160 flex-col gap-2 px-4 py-16"
      role="alert"
    >
      <h1 className="text-2xl font-semibold text-slate-900">
        Something went wrong
      </h1>
      <p className="text-slate-600">
        This page couldn't load. Reloading may fix it.
      </p>
    </div>
  );
};

export { RouteError };
