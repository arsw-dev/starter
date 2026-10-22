import { environmentManager } from '@tanstack/react-query';

// How long a read or a write takes at the least, in the browser: a skeleton or
// a pending state that shows for a few milliseconds reads as a flicker
const MIN_DURATION = {
  query: 400,
  mutation: 250,
} as const;

type Timing = {
  // In milliseconds; 0 for none
  minDuration?: number;
};

const wait = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// The work's result, no sooner than ms. A failure waits too, so an error
// doesn't flash in either. Never on the server, where it would only hold the
// page's stream
const atLeast = async <T>(ms: number, work: Promise<T>) => {
  if (ms <= 0 || environmentManager.isServer()) {
    return work;
  }

  const delay = wait(ms);

  try {
    return await work;
  } finally {
    await delay;
  }
};

export { MIN_DURATION, atLeast };
export type { Timing };
