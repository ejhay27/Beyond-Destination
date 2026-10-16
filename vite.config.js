import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    // Generated native copies and browser traces must not reload an active life.
    watch: { ignored: ['**/.artifacts/**', '**/android/**'] },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 4096,
    // Three.js is bundled locally so the static game has no CDN/runtime dependency.
    chunkSizeWarningLimit: 700,
  },
});
