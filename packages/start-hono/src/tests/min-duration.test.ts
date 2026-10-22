import {
  MutationObserver,
  QueryClient,
  environmentManager,
} from '@tanstack/react-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { defineApi } from '#/factory.ts';
import { atLeast } from '#/min-duration.ts';

// Whether a promise has settled, read after the clock moves
const track = (promise: Promise<unknown>) => {
  const state = {
    settled: false,
  };

  void promise
    .catch(() => undefined)
    .finally(() => {
      state.settled = true;
    });

  return state;
};

// Stand-ins for server functions taking no input, in the shape Start gives them
type NoInput = {
  data?: undefined;
  signal?: AbortSignal;
};

const getAll = vi.fn(async (_options?: NoInput) => ['Write tests']);

const create = vi.fn(async (_options?: NoInput) => 'Write tests');

const todosApi = defineApi('todos', (api) => ({
  getAll: api.query(getAll),
  instant: api.query(getAll, {
    minDuration: 0,
  }),
  create: api.mutation(create),
}));

beforeEach(() => {
  environmentManager.setIsServer(() => false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  environmentManager.setIsServer(() => typeof window === 'undefined');
});

describe('atLeast', () => {
  it('holds a quick result until the time is up', async () => {
    const state = track(atLeast(400, Promise.resolve('done')));

    await vi.advanceTimersByTimeAsync(399);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.settled).toBe(true);
  });

  it('holds a failure too', async () => {
    const work = atLeast(400, Promise.reject(new Error('down')));
    const state = track(work);

    await vi.advanceTimersByTimeAsync(399);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(work).rejects.toThrow('down');
  });

  it('adds nothing to work that takes longer', async () => {
    const slow = new Promise((resolve) => {
      setTimeout(resolve, 600, 'done');
    });
    const state = track(atLeast(400, slow));

    await vi.advanceTimersByTimeAsync(600);
    expect(state.settled).toBe(true);
  });

  it('never waits on the server', async () => {
    environmentManager.setIsServer(() => true);

    const state = track(atLeast(400, Promise.resolve('done')));

    await vi.advanceTimersByTimeAsync(0);
    expect(state.settled).toBe(true);
  });
});

describe('defineApi', () => {
  it('holds a query for 400ms unless its definition says otherwise', async () => {
    const client = new QueryClient();
    const held = track(client.query(todosApi.getAll()));
    const instant = track(client.query(todosApi.instant()));

    await vi.advanceTimersByTimeAsync(399);
    expect(held.settled).toBe(false);
    expect(instant.settled).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(held.settled).toBe(true);
  });

  it('holds a mutation for 250ms unless its call site says otherwise', async () => {
    const client = new QueryClient();
    const held = track(
      new MutationObserver(client, todosApi.create()).mutate(),
    );
    const instant = track(
      new MutationObserver(
        client,
        todosApi.create({
          minDuration: 0,
        }),
      ).mutate(),
    );

    await vi.advanceTimersByTimeAsync(249);
    expect(held.settled).toBe(false);
    expect(instant.settled).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(held.settled).toBe(true);
  });
});
