import { ApiError } from './api.error.ts';

import type { Issue } from '@arsw/todos-api/client';

const isIssue = (value: unknown): value is Issue =>
  typeof value === 'object' &&
  value !== null &&
  'in' in value &&
  typeof value.in === 'string' &&
  'path' in value &&
  typeof value.path === 'string' &&
  'message' in value &&
  typeof value.message === 'string';

// An invalid request's issues: the API's own messages about what was wrong,
// safe to show. Anything else answering 422 brings none
const issuesOf = async (response: Response): Promise<Issue[]> => {
  const body: unknown = await response.json().catch(() => undefined);

  if (
    typeof body !== 'object' ||
    body === null ||
    !('issues' in body) ||
    !Array.isArray(body.issues)
  ) {
    return [];
  }

  return body.issues.filter(isIssue);
};

// A todos-api response as a server function returns it: the success body,
// nothing for a 204, which has none, or an ApiError
const unwrap = async (response: Response): Promise<unknown> => {
  if (response.ok) {
    return response.status === 204 ? undefined : response.json();
  }

  throw new ApiError(
    response.status,
    response.status === 422 ? await issuesOf(response) : [],
  );
};

export { unwrap };
