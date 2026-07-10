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
        'src/main/modules/configRepository.ts': {
          lines: 95,
          branches: 80,
          functions: 90,
          statements: 95,
        },
        'src/main/modules/localServer.ts': {
          lines: 94,
          branches: 75,
          functions: 90,
          statements: 94,
        },
        'src/main/plugins/pluginInstallerCore.ts': {
          lines: 88,
          branches: 72,
          functions: 93,
          statements: 88,
        },
        'src/renderer/providers/translate/deepl/translate.ts': {
          lines: 87,
          branches: 68,
          functions: 95,
          statements: 87,
        },
        'src/renderer/providers/translate/ollama/translate.ts': {
          lines: 90,
          branches: 72,
          functions: 95,
          statements: 87,
        },
        'src/renderer/windows/Screenshot/selection.ts': {
          100: true,
        },
        'src/renderer/windows/Updater/useUpdaterController.ts': {
          lines: 82,
          branches: 70,
          functions: 95,
          statements: 82,
        },
      },
    },
  },
})
