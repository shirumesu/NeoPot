import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { ForgeConfig } from '@electron-forge/shared-types'
import VitePlugin from '@electron-forge/plugin-vite'

const packagedRuntimePathPrefixes = [
  '/.vite',
  '/package.json',
  '/node_modules/better-sqlite3',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
  '/node_modules/.pnpm/better-sqlite3@',
  '/node_modules/.pnpm/bindings@',
  '/node_modules/.pnpm/file-uri-to-path@',
]

const config: ForgeConfig = {
  outDir: 'out/package',
  packagerConfig: {
    asar: {
      unpack: '**/*.node',
    },
    icon: 'public/icon',
    ignore: (file) => {
      if (!file) {
        return false
      }

      const normalizedFile = file.replace(/\\/g, '/')
      return !packagedRuntimePathPrefixes.some((prefix) => normalizedFile.startsWith(prefix))
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const moduleNames = ['better-sqlite3', 'bindings', 'file-uri-to-path']
      const targetNodeModules = path.join(buildPath, 'node_modules')
      await mkdir(targetNodeModules, { recursive: true })

      await Promise.all(
        moduleNames.map((moduleName) =>
          cp(
            path.join(process.cwd(), 'node_modules', moduleName),
            path.join(targetNodeModules, moduleName),
            {
              recursive: true,
              dereference: true,
            },
          ),
        ),
      )
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
}

export default config
