import { defineConfig } from 'vite-plus';

import { pack } from '@arsw/vite-config';

export default defineConfig({
  pack: pack(['src/main.ts']),
});
