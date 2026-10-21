import { createSerializationAdapter } from '@tanstack/react-router';

import type { Issue } from '@arsw/todos-api/client';

// A call to todos-api that failed: its status, and for an invalid request, what
// was wrong with each field. It reaches the browser, so the rest of the API's
// body stays on the server
class ApiError extends Error {
  status: number;
  issues: Issue[];

  constructor(status: number, issues: Issue[] = []) {
    super(`todos-api answered ${status}`);

    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

const isServerError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status >= 500;

// Without it, a thrown ApiError reaches the browser as a plain Error: the
// message survives, the class, status and issues don't
const apiErrorAdapter = createSerializationAdapter({
  key: 'api-error',
  test: (value): value is ApiError => value instanceof ApiError,
  toSerializable: (error) => ({
    status: error.status,
    issues: error.issues,
  }),
  fromSerializable: ({ status, issues }) => new ApiError(status, issues),
});

export { ApiError, apiErrorAdapter, isServerError };
