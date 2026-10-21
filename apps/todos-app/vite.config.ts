import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig(({ mode }) => ({
  // Reached only through @arsw/start-hono, so Vite would find it on the first
  // page load and reload midway, with two copies of React on the page
  optimizeDeps: {
    include: ['@tanstack/react-router-ssr-query'],
  },
  // Tests run in Node, on the app's own code: Cloudflare's plugin would run
  // them as the Worker
  plugins:
    mode === 'test'
      ? []
      : [
          devtools(),
          cloudflare({
            viteEnvironment: {
              name: 'ssr',
            },
          }),
          tanstackStart(),
          // The React Compiler memoizes components and hooks at build time,
          // through Oxc rather than Babel
          react({
            compiler: true,
          }),
          tailwindcss(),
        ],
}));
