import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node22',
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((moduleName) => `node:${moduleName}`),
      ],
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: 'preload.cjs',
        chunkFileNames: 'preload.cjs',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
