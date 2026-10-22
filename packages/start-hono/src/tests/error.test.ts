import { describe, expect, it } from 'vite-plus/test';

import { ApiError, apiErrorAdapter } from '#/error.ts';

describe('apiErrorAdapter', () => {
  it('takes an ApiError across as an ApiError, with its api, status and issues', () => {
    const issue = {
      in: 'json',
      path: 'title',
      message: 'Title is required',
    };
    const sent = apiErrorAdapter.toSerializable(
      new ApiError('todos-api', 422, [issue]),
    );
    const received = apiErrorAdapter.fromSerializable(structuredClone(sent));

    expect(received).toBeInstanceOf(ApiError);
    expect(received).toMatchObject({
      api: 'todos-api',
      status: 422,
      issues: [issue],
      message: 'todos-api answered 422',
    });
  });

  it('takes only ApiErrors', () => {
    expect(apiErrorAdapter.test(new ApiError('todos-api', 500))).toBe(true);
    expect(apiErrorAdapter.test(new Error('todos-api answered 500'))).toBe(
      false,
    );
  });
});
