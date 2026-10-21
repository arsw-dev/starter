import { describe, expect, it } from 'vite-plus/test';

import { ApiError } from '#/error.ts';
import { unwrap } from '#/unwrap.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

const rejection = async (response: Response) =>
  unwrap('todos-api', response).then(
    () => {
      throw new Error('unwrap resolved');
    },
    (error: unknown) => error,
  );

describe('unwrap', () => {
  it("returns a success's body", async () => {
    await expect(
      unwrap(
        'todos-api',
        json(
          {
            title: 'Write tests',
          },
          200,
        ),
      ),
    ).resolves.toEqual({
      title: 'Write tests',
    });
  });

  it('returns nothing for a 204', async () => {
    await expect(
      unwrap(
        'todos-api',
        new Response(null, {
          status: 204,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('throws an ApiError with the status, and no issues, for a failure', async () => {
    const error = await rejection(
      new Response('Worker "todos-api" not found', {
        status: 503,
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      api: 'todos-api',
      status: 503,
      issues: [],
    });
  });

  it("brings an invalid request's issues", async () => {
    const issue = {
      in: 'json',
      path: 'title',
      message: 'Title is required',
    };

    const error = await rejection(
      json(
        {
          message: 'Invalid Request',
          issues: [issue],
        },
        422,
      ),
    );

    expect(error).toMatchObject({
      status: 422,
      issues: [issue],
    });
  });

  it('brings no issues from a 422 that has none to give', async () => {
    const error = await rejection(
      json(
        {
          issues: [
            {
              path: 'title',
            },
          ],
        },
        422,
      ),
    );

    expect(error).toMatchObject({
      status: 422,
      issues: [],
    });
  });
});
