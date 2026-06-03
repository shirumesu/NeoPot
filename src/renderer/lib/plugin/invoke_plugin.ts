import { appCacheDir, appConfigDir, join } from '@/renderer/lib/electron/compat/path'
import { readFile, readTextFile } from '@/renderer/lib/electron/compat/fs'
import { invoke } from '@/renderer/lib/electron/compat/core'
import { osType } from '../config/env'
import * as http from '@/renderer/lib/electron/http'
import { createPluginLogger } from '@/renderer/lib/logger'
import { getStoreValue } from '../config/store'

async function loadPluginEntrypoint(script: string, pluginType: string) {
  const moduleSource = `${script}\nexport default typeof ${pluginType} !== 'undefined' ? ${pluginType} : undefined;\n`
  const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }))

  try {
    const pluginModule = await import(/* @vite-ignore */ moduleUrl)
    return pluginModule.default
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }
}

export async function invoke_plugin(pluginType: string, pluginName: string) {
  const configDir = await appConfigDir()
  const cacheDir = await appCacheDir()
  const pluginDir = await join(configDir, 'plugins', pluginType, pluginName)
  const entryFile = await join(pluginDir, 'main.js')
  const script = await readTextFile(entryFile)
  const pluginOptions = (await getStoreValue(`plugin_options:${pluginType}:${pluginName}`)) ?? {}
  async function run(cmdName: string, args: unknown) {
    return await invoke('run_binary', {
      pluginType,
      pluginName,
      cmdName,
      args,
    })
  }
  const utils = {
    tauriFetch: http.fetch,
    http,
    readFile,
    readTextFile,
    run,
    cacheDir, // String
    pluginDir, // String
    pluginOptions,
    osType, // "Windows_NT", "Darwin", "Linux"
    log: createPluginLogger({
      pluginType,
      pluginName,
    }),
  }
  const entrypoint = await loadPluginEntrypoint(script, pluginType)
  if (typeof entrypoint !== 'function') {
    throw new Error(`Plugin "${pluginName}" does not expose a "${pluginType}" function`)
  }
  return [entrypoint, utils]
}
