import path from 'node:path'
import type { ForgeConfig } from '@electron-forge/shared-types'
import VitePlugin from '@electron-forge/plugin-vite'

const packagedRuntimePathPrefixes = ['/.vite', '/package.json', '/public']

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
      config: {
        name: 'neopot',
        iconUrl:
          'https://raw.githubusercontent.com/shirumesu/Neopot/refactor/electron/public/icon.ico',
        setupExe: 'NeoPot-Setup.exe',
        setupMsi: 'NeoPot-Setup.msi',
        setupIcon: path.resolve('public', 'icon.ico'),
      },
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
