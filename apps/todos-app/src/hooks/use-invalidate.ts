import { useQueryClient } from '@tanstack/react-query';

import type { QueryKey } from '@tanstack/react-query';

// Several keys made stale in one call, for a write that touches more than its
// definition's invalidates names
const useInvalidate = () => {
  const client = useQueryClient();

  return async (...keys: QueryKey[]) => {
    await Promise.all(
      keys.map(async (queryKey) =>
        client.invalidateQueries({
          queryKey,
        }),
      ),
    );
  };
};

export { useInvalidate };
