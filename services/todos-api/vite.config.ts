import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vite-plus';

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
      miniflare: {
        bindings: {
          // Read here, in Node, and applied in workerd by the setup file, so
          // every test runs against the table the migrations build
          TEST_MIGRATIONS: await readD1Migrations(
            path.join(import.meta.dirname, 'migrations'),
          ),
        },
      },
    }),
  ],
  test: {
    setupFiles: ['./src/db/db.setup.ts'],
  },
}));
