import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // Ignored paths
  {
    ignores: [
      'node_modules',
      'dist',
      'out',
      '.vite',
      'spec',
      'docs',
      '**/*.cjs',
      'updater',
      '.tmp-*',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React core rules
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // React Hooks rules
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // TypeScript-specific adjustments
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-duplicate-enum-values': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      'prefer-const': 'warn',
    },
  },

  // Renderer files (browser + Electron APIs)
  {
    files: ['src/renderer/**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },

  // Main and preload process files (pure Node)
  {
    files: ['src/main/**/*.{ts,tsx}', 'src/preload/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Browser helper files kept as JS during migration
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-undef': 'error',
      'prefer-const': 'warn',
    },
  },

  // Build configuration and scripts
  {
    files: ['*.config.{js,ts}', 'forge.config.ts', '.scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'prefer-const': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Automated tests execute in Node, with browser globals available to DOM and Electron journeys.
  {
    files: ['tests/**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Disable rules that conflict with Prettier (must be last)
  prettierConfig,
)
