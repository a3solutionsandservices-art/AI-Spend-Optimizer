import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/subscriptions':   { target: 'http://localhost:3001', changeOrigin: true },
      '/insights':        { target: 'http://localhost:3001', changeOrigin: true },
      '/detect-category': { target: 'http://localhost:3001', changeOrigin: true },
      '/scan':            { target: 'http://localhost:3001', changeOrigin: true },
      '/auth':            { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
