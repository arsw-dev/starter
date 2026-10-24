import type { D1Migration } from 'cloudflare:test';

// Only tests have this binding: vite.config.ts reads the migrations into it.
// The API's tsconfig includes this file, so the tests see it; a front end's
// program never reaches the tests, and doesn't need it
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
