import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_'],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        daemon: resolve(__dirname, 'daemon.html'),
      },
    },
    target: 'es2020',
    minify: 'esbuild',
  },
}))
