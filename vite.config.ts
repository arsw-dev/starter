import { defineConfig } from 'vite-plus';

import { fmt, lint } from '@arsw/vite-config';

export default defineConfig({
  fmt,
  lint,
  test: {
    // Each package tests in its own runtime:
    // a Worker's in workerd, the rest in Node
    projects: ['apps/*', 'packages/*', 'services/*'],
  },
});
