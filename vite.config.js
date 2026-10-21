import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Mirrors the Netlify proxy in netlify.toml so /api/ganjoor works locally too.
    proxy: {
      '/api/ganjoor': {
        target: 'https://api.ganjoor.net',
        changeOrigin: true,
      },
    },
  },
});
