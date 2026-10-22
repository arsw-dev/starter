import { environmentManager, noop } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { ApiError } from '#/error.ts';
import { createQueryClient } from '#/query-client.ts';

const setup = () => {
  const onServerError = vi.fn();
  const client = createQueryClient({
    onServerError,
  });
  const retry = client.getDefaultOptions().queries?.retry;

  if (typeof retry !== 'function') {
    throw new Error('createQueryClient sets retry');
  }

  return {
    onServerError,
    retry,
    // A read that fails once, for reason, which the cache reports
    fail: async (reason: Error) =>
      client
        .query({
          queryKey: ['todos', reason.message],
          queryFn: () => {
            throw reason;
          },
          retry: false,
        })
        .catch(noop),
  };
};

const inTheBrowser = (browser: boolean) => {
  environmentManager.setIsServer(() => !browser);
};

afterEach(() => {
  environmentManager.setIsServer(() => typeof window === 'undefined');
});

describe('retry', () => {
  it('never retries on the server', () => {
    inTheBrowser(false);

    expect(setup().retry(0, new ApiError('todos-api', 503))).toBe(false);
  });

  it('never retries what the API refused', () => {
    inTheBrowser(true);

    expect(setup().retry(0, new ApiError('todos-api', 404))).toBe(false);
  });

  it('retries anything else three times in the browser', () => {
    inTheBrowser(true);

    const { retry } = setup();

    expect(retry(2, new ApiError('todos-api', 503))).toBe(true);
    expect(retry(2, new Error('timed out'))).toBe(true);
    expect(retry(3, new ApiError('todos-api', 503))).toBe(false);
  });
});

describe('a failed read', () => {
  it('reports a server error in the browser', async () => {
    inTheBrowser(true);

    const { fail, onServerError } = setup();
    const error = new ApiError('todos-api', 502);

    await fail(error);

    expect(onServerError).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("leaves the rest to the page, and the server's to the browser", async () => {
    inTheBrowser(true);

    const browser = setup();

    await browser.fail(new ApiError('todos-api', 404));
    await browser.fail(new Error('timed out'));

    inTheBrowser(false);

    const server = setup();

    await server.fail(new ApiError('todos-api', 502));

    expect(browser.onServerError).not.toHaveBeenCalled();
    expect(server.onServerError).not.toHaveBeenCalled();
  });
});
