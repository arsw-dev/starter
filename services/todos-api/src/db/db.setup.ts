import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import type { D1Migration } from 'cloudflare:test';

// Only tests have this binding: vite.config.ts reads the migrations into it
declare global {
  namespace Cloudflare {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- adding to Env needs declaration merging, which only an interface does
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

// Before each test file. Applied migrations are recorded in d1_migrations, so
// each one runs once
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
