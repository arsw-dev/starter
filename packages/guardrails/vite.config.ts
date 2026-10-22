import { defineConfig } from 'vite-plus';

// Written out, not vite-config's pack: vite-config depends on guardrails. Only
// oxlint loads it, and nothing imports its types, so it has no declarations
export default defineConfig({
  pack: {
    entry: ['src/main.ts'],
    deps: {
      neverBundle: true,
    },
    dts: false,
  },
});
