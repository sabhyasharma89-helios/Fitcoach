import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173/Fitcoach/',
    // Samsung Galaxy S25 Ultra: ~412 × 891 CSS px
    viewport: { width: 412, height: 891 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Fitcoach/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
