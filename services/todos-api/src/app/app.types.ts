import type { DB } from '@arsw/kiln/model';

// What every request carries, for the routers and any middleware: the
// database, which main.ts's first middleware sets
type Variables = {
  db: DB;
};

export type { Variables };
