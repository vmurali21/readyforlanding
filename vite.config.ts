import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy for Flightradar24 API
      '/fr24api': {
        target: 'https://fr24api.flightradar24.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fr24api/, '')
      },
      // Proxy for Google Maps API
      '/mapsapi': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mapsapi/, '')
      }
    }
  }
});