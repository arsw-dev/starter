import { cloudflare } from '@cloudflare/vite-plugin';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig(({ mode }) => ({
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
          react(),
        ],
}));
