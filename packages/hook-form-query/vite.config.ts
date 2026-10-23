import { defineConfig } from 'vite-plus';

import { pack } from '@arsw/vite-config';

export default defineConfig({
  pack: pack(['src/main.ts']),
  // Fields render in a DOM, with real Radix primitives
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/dom.setup.ts'],
  },
});
