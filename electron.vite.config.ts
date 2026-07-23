import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'electron-vite'

const external = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]

const bundledMainDependencies = [
  'adm-zip',
  'electron-log',
  'electron-store',
  'electron-updater',
  'tinyld',
]

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: bundledMainDependencies,
      },
      target: 'node22',
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
        external,
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name].cjs',
        },
      },
    },
  },
  preload: {
    build: {
      target: 'node22',
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
        external,
        output: {
          format: 'cjs',
          inlineDynamicImports: true,
          entryFileNames: 'index.cjs',
          chunkFileNames: 'index.cjs',
          assetFileNames: '[name].[ext]',
        },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@assets': resolve(__dirname, 'assets'),
        fs: resolve(__dirname, 'src/renderer/lib/nodeBuiltinUnavailable.ts'),
        path: resolve(__dirname, 'src/renderer/lib/nodeBuiltinUnavailable.ts'),
        crypto: resolve(__dirname, 'src/renderer/lib/nodeBuiltinUnavailable.ts'),
      },
    },
    clearScreen: false,
    build: {
      target: 'es2020',
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
  },
})
