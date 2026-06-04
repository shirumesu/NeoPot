import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const external = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['electron-store'],
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
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@assets': resolve(__dirname, 'assets'),
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
