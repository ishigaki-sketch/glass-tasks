import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 開発時は API / 認証を wrangler dev（:8787）へ転送
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
