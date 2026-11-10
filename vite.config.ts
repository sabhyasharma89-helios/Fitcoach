/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo at https://<owner>.github.io/Fitcoach/.
// The Android (Capacitor) build loads files from the app bundle, so it needs a relative base.
const isCapacitor = process.env.BUILD_TARGET === 'android';
const base = isCapacitor ? './' : (process.env.VITE_BASE ?? '/Fitcoach/');

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: isCapacitor,
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'privacy.html'],
      manifest: {
        name: 'FitOS',
        short_name: 'FitOS',
        description: 'Personal weight-management: workouts, food, weight, waist and steps.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Exercise images are precached so every card works offline.
        globPatterns: ['**/*.{js,css,html,png,svg,jpg,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
