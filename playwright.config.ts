import { defineConfig } from '@playwright/test';

// Smoke suite E2E per l'app Electron ArchiView.
// I test lanciano l'app buildata (out/main/main.js) con una userData temporanea
// isolata (vedi e2e/fixtures.ts). Prerequisito: `npm run build-ts` (gestito da pretest:e2e).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // una sola istanza Electron alla volta
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
