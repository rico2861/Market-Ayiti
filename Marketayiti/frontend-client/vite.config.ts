import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => { /* suppress expected WS disconnect noise */ });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          i18n:   ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          ui:     ['lucide-react', 'react-hot-toast'],
          http:   ['axios'],
        }
      }
    }
  }
});
