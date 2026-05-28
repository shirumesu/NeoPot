import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // Ignored paths
  {
    ignores: ['node_modules', 'dist', 'out', '.vite', '**/*.cjs', 'updater'],
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
    rules: reactHooks.configs.recommended.rules,
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
    files: ['.scripts/**/*.mjs', 'spec/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Disable rules that conflict with Prettier (must be last)
  prettierConfig,
)
