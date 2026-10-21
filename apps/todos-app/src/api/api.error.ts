import { createSerializationAdapter } from '@tanstack/react-router';

// A call to todos-api that failed, by its status alone: it reaches the
// browser, so the API's body stays on the server
class ApiError extends Error {
  status: number;

  constructor(status: number) {
    super(`todos-api answered ${status}`);

    this.name = 'ApiError';
    this.status = status;
  }
}

// Without it, a thrown ApiError reaches the browser as a plain Error: the
// message survives, the class and status don't
const apiErrorAdapter = createSerializationAdapter({
  key: 'api-error',
  test: (value): value is ApiError => value instanceof ApiError,
  toSerializable: (error) => ({
    status: error.status,
  }),
  fromSerializable: ({ status }) => new ApiError(status),
});

export { ApiError, apiErrorAdapter };
