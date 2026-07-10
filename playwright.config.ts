import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/playwright-report' }]],
  outputDir: 'test-results/playwright-artifacts',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
