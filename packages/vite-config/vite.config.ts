import { defineConfig } from 'vite-plus';

import { pack } from './src/pack.ts';

export default defineConfig({
  pack: pack(['src/main.ts']),
});
