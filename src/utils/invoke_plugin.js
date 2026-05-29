import { appCacheDir, appConfigDir, join } from '@/utils/electron_compat/path'
import { readFile, readTextFile } from '@/utils/electron_compat/fs'
import { invoke } from '@/utils/electron_compat/core'
import CryptoJS from 'crypto-js'
import { osType } from './env'
import * as http from '@/utils/electron_http'

async function loadPluginEntrypoint(script, pluginType) {
  const moduleSource = `${script}\nexport default typeof ${pluginType} !== 'undefined' ? ${pluginType} : undefined;\n`
  const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }))

  try {
    const pluginModule = await import(/* @vite-ignore */ moduleUrl)
    return pluginModule.default
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }
}

export async function invoke_plugin(pluginType, pluginName) {
  const configDir = await appConfigDir()
  const cacheDir = await appCacheDir()
  const pluginDir = await join(configDir, 'plugins', pluginType, pluginName)
  const entryFile = await join(pluginDir, 'main.js')
  const script = await readTextFile(entryFile)
  async function run(cmdName, args) {
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
    CryptoJS,
    run,
    cacheDir, // String
    pluginDir, // String
    osType, // "Windows_NT", "Darwin", "Linux"
  }
  const entrypoint = await loadPluginEntrypoint(script, pluginType)
  if (typeof entrypoint !== 'function') {
    throw new Error(`Plugin "${pluginName}" does not expose a "${pluginType}" function`)
  }
  return [entrypoint, utils]
}
