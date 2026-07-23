import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'assets'),
    },
  },
  test: {
    include: [
      'tests/unit/**/*.test.{mjs,ts,tsx}',
      'tests/integration/**/*.test.{mjs,ts,tsx}',
      'tests/component/**/*.test.{mjs,ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: 'test-results/coverage',
      thresholds: {
        lines: 25,
        branches: 20,
        functions: 25,
        statements: 25,
        'src/renderer/windows/Screenshot/selection.ts': {
          100: true,
        },
      },
    },
  },
})
