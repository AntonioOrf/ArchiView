import { defineConfig } from '@playwright/test';

const { PROJECTS, testMatchFor } = require('./e2e/projects');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : '50%',
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: Object.keys(PROJECTS).map(nome => ({
    name: nome,
    testMatch: testMatchFor(nome),
  })),
});
