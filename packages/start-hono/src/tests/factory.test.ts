import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { describe, expect, expectTypeOf, it, vi } from 'vite-plus/test';

import { defineApi } from '#/factory.ts';

import type { QueryKey, UseMutationOptions } from '@tanstack/react-query';

type Todo = {
  id: string;
  title: string;
};

// Stand-ins for server functions: the shapes Start gives them, one taking
// input and one taking none
const todo = (title: string): Todo => ({
  id: 'b1946ac9',
  title,
});

type NoInput = {
  data?: undefined;
  signal?: AbortSignal;
};

type Input<TData> = {
  data: TData;
};

const getAll = vi.fn(async (_options?: NoInput) => [todo('Write tests')]);

const get = vi.fn(
  async ({
    data,
  }: Input<{
    id: string;
  }>) => ({
    ...todo('Write tests'),
    id: data.id,
  }),
);

const create = vi.fn(
  async ({
    data,
  }: Input<{
    title: string;
  }>) => todo(data.title),
);

const todosApi = defineApi('todos', (api) => ({
  getAll: api.query(getAll, {
    staleTime: 1000,
  }),
  get: api.query(get),
  create: api.mutation(create, {
    invalidates: (): QueryKey[] => [todosApi.getAll.baseKey],
  }),
  comments: {
    list: api.query(getAll),
  },
}));

const mutate = async <TData, TVariables, TOnMutateResult>(
  client: QueryClient,
  options: UseMutationOptions<TData, Error, TVariables, TOnMutateResult>,
  variables: TVariables,
) => new MutationObserver(client, options).mutate(variables);

describe('keys', () => {
  it('starts with the namespace, then the property', () => {
    expect(todosApi.getAll.baseKey).toEqual(['todos', 'getAll']);
    expect(todosApi.create.mutationKey).toEqual(['todos', 'create']);
  });

  it('gives each namespace a key of its own', () => {
    expect(todosApi.baseKey).toEqual(['todos']);
    expect(todosApi.comments.baseKey).toEqual(['todos', 'comments']);
  });

  it('reserves baseKey', () => {
    defineApi('todos', (api) => ({
      // @ts-expect-error a definition can't take the namespace's key
      baseKey: api.query(getAll),
    }));
  });

  it('walks nested objects', () => {
    expect(todosApi.comments.list.baseKey).toEqual([
      'todos',
      'comments',
      'list',
    ]);
  });

  it('ends with the params, when there are any', () => {
    const params = {
      id: 'b1946ac9',
    };

    expect(todosApi.get.getQueryKey(params)).toEqual(['todos', 'get', params]);
    expect(todosApi.get(params).queryKey).toEqual(['todos', 'get', params]);
  });

  it('has no slot for params when there are none', () => {
    expect(todosApi.getAll.getQueryKey()).toEqual(['todos', 'getAll']);
    expect(todosApi.getAll().queryKey).toEqual(['todos', 'getAll']);
  });
});

describe('queries', () => {
  it('calls the server function with the params as data, and the signal', async () => {
    const client = new QueryClient();

    await client.query(
      todosApi.get({
        id: 'b1946ac9',
      }),
    );

    expect(get).toHaveBeenLastCalledWith({
      data: {
        id: 'b1946ac9',
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("applies the definition's defaults", () => {
    expect(todosApi.getAll().staleTime).toBe(1000);
  });

  it('types the cache by the key', async () => {
    const client = new QueryClient();

    await client.query(todosApi.getAll());

    expectTypeOf(client.getQueryData(todosApi.getAll().queryKey)).toEqualTypeOf<
      Todo[] | undefined
    >();
  });
});

describe('mutations', () => {
  it('calls the server function with the variables as data', async () => {
    const client = new QueryClient();

    await mutate(client, todosApi.create(), {
      title: 'Ship it',
    });

    expect(create).toHaveBeenLastCalledWith({
      data: {
        title: 'Ship it',
      },
    });
  });

  it("invalidates the definition's keys before the call site's onSuccess", async () => {
    const client = new QueryClient();
    const order: string[] = [];

    vi.spyOn(client, 'invalidateQueries').mockImplementation(
      async (filters) => {
        order.push(`invalidate ${JSON.stringify(filters?.queryKey)}`);
      },
    );

    await mutate(
      client,
      todosApi.create({
        onSuccess: () => {
          order.push('onSuccess');
        },
      }),
      {
        title: 'Ship it',
      },
    );

    expect(order).toEqual(['invalidate ["todos","getAll"]', 'onSuccess']);
  });

  it("lets the call site's options replace the definition's", async () => {
    const client = new QueryClient();
    const onError = vi.fn();
    const failing = defineApi('todos', (api) => ({
      create: api.mutation(create, {
        onError,
      }),
    }));
    const callSite = vi.fn();

    create.mockRejectedValueOnce(new Error('todos-api answered 500'));

    await expect(
      mutate(
        client,
        failing.create({
          onError: callSite,
        }),
        {
          title: 'Ship it',
        },
      ),
    ).rejects.toThrow('todos-api answered 500');

    expect(callSite).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });
});
