import type { DB } from '@arsw/kiln/model';

// What every request carries, for every router and middleware: the database,
// which the first middleware sets. main.ts references this file, so any program
// with the app's type, a front end's among them, has it too
declare module '@arsw/kiln' {
  interface Register {
    variables: {
      db: DB;
    };
  }
}
