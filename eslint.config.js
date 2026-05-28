import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
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

  // React Hooks rules
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Project-wide TypeScript compatibility
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-duplicate-enum-values': 'warn',
      'prefer-const': 'warn',
    },
  },

  // Browser helper files kept as JS during the migration
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'error',
      'prefer-const': 'warn',
    },
  },

  // Source files (renderer)
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },

  // Node/Electron main process files
  {
    files: ['src/main/**/*.{ts,tsx}', 'src/preload/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Node scripts and tests (.mjs files outside src)
  {
    files: ['.scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Build configuration files
  {
    files: ['*.config.{js,ts}', 'forge.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'prefer-const': 'warn',
    },
  },

  // Disable rules that conflict with Prettier (must be last)
  prettierConfig,
)
