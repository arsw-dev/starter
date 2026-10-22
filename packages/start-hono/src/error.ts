import { createSerializationAdapter } from '@tanstack/react-router';

// What the API said was wrong with a request, one field at a time: where the
// field was (in), which one (path), and the problem (message)
type Issue = {
  in: string;
  path: string;
  message: string;
};

// A call to the API that failed: its status, and for an invalid request, what
// was wrong with each field. It reaches the browser, so the rest of the API's
// body stays on the server
class ApiError extends Error {
  api: string;
  status: number;
  issues: Issue[];

  constructor(api: string, status: number, issues: Issue[] = []) {
    super(`${api} answered ${status}`);

    this.name = 'ApiError';
    this.api = api;
    this.status = status;
    this.issues = issues;
  }
}

const isServerError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status >= 500;

// Without it, a thrown ApiError reaches the browser as a plain Error: the
// message survives, the class, API, status and issues don't
const apiErrorAdapter = createSerializationAdapter({
  key: 'api-error',
  test: (value): value is ApiError => value instanceof ApiError,
  toSerializable: (error) => ({
    api: error.api,
    status: error.status,
    issues: error.issues,
  }),
  fromSerializable: ({ api, status, issues }) =>
    new ApiError(api, status, issues),
});

export { ApiError, apiErrorAdapter, isServerError };
export type { Issue };
