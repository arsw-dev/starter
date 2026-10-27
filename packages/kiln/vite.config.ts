import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vite-plus';

import { pack } from '@arsw/vite-config';

export default defineConfig({
  // The model is checked against a real D1, in workerd
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
    }),
  ],
  pack: pack(['src/main.ts', 'src/model.ts', 'src/cli.ts']),
});
