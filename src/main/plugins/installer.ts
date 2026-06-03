import { app, globalShortcut } from 'electron'
import AdmZip from 'adm-zip'
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfig, setConfig } from '../modules/config'
import { logger } from '../logger'

const SERVICE_PLUGIN_TYPES = ['translate', 'recognize', 'tts']

export interface PluginInfo {
  id: string
  type: string
  name: string
  display: string
  version: string
  author: string
  description: string
  icon: string
  enabled: boolean
  needs: unknown[]
  options: unknown[]
  hotkeys: unknown[]
  [key: string]: unknown
}

export interface PluginInstallResult {
  status: 'installed'
  type: string
  name: string
}

class PluginInstallError extends Error {
  constructor(
    readonly code: 'PLUGIN_INVALID_PACKAGE' | 'PLUGIN_ZIP_SLIP',
    message: string,
  ) {
    super(message)
    this.name = 'PluginInstallError'
  }
}

export function pluginRoot(): string {
  return path.join(app.getPath('userData'), 'plugins')
}

function pluginEnabledKey(type: string, name: string): string {
  return `plugin:${type}:${name}:enabled`
}

function pluginHotkeyConfigKey(type: string, name: string, key: string): string {
  return `plugin_hotkey:${type}:${name}:${key}`
}

function assertInside(parent: string, child: string): void {
  const parentPath = path.resolve(parent)
  const childPath = path.resolve(child)
  if (!childPath.startsWith(parentPath + path.sep)) {
    throw new PluginInstallError(
      'PLUGIN_ZIP_SLIP',
      'Plugin package contains an unsafe extraction path.',
    )
  }
}

function getPluginEnabled(type: string, name: string): boolean {
  const stored = getConfig(pluginEnabledKey(type, name))
  return typeof stored === 'boolean' ? stored : true
}

async function isDirectory(filePath: string): Promise<boolean> {
  return stat(filePath)
    .then((stats) => stats.isDirectory())
    .catch(() => false)
}

async function exists(filePath: string): Promise<boolean> {
  return stat(filePath)
    .then(() => true)
    .catch(() => false)
}

function parseManifest(text: string): { plugin_type?: string; name?: string } {
  try {
    return JSON.parse(text) as { plugin_type?: string; name?: string }
  } catch (error) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `Plugin manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function assertManifestIdentity(manifest: { plugin_type?: string; name?: string }): {
  pluginType: string
  pluginName: string
} {
  const pluginType = manifest.plugin_type
  const pluginName = manifest.name
  if (!pluginType || !pluginName) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin manifest is missing plugin_type or name.',
    )
  }

  return { pluginType, pluginName }
}

async function readPluginManifest(type: string, name: string): Promise<PluginInfo | null> {
  const pluginDir = path.join(pluginRoot(), type, name)
  const manifestPath = path.join(pluginDir, 'info.json')
  const manifestText = await readFile(manifestPath, 'utf8').catch(() => null)
  if (!manifestText) {
    return null
  }

  const manifest = JSON.parse(manifestText) as Record<string, unknown>
  const display = typeof manifest.display === 'string' ? manifest.display : name
  const icon = typeof manifest.icon === 'string' ? path.join(pluginDir, manifest.icon) : ''

  return {
    ...manifest,
    id: `${type}:${name}`,
    type,
    name,
    plugin_type: type,
    display,
    version: typeof manifest.version === 'string' ? manifest.version : '',
    author: typeof manifest.author === 'string' ? manifest.author : '',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    icon,
    enabled: getPluginEnabled(type, name),
    needs: Array.isArray(manifest.needs) ? manifest.needs : [],
    options: Array.isArray(manifest.options) ? manifest.options : [],
    hotkeys: Array.isArray(manifest.hotkeys) ? manifest.hotkeys : [],
  }
}

export async function getInstalledPluginHotkey(
  type: string,
  name: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const manifest = await readPluginManifest(type, name)
  if (!manifest?.enabled) {
    return null
  }

  const hotkey = manifest?.hotkeys.find((item) => {
    return typeof item === 'object' && item !== null && (item as { key?: unknown }).key === key
  })

  return hotkey && typeof hotkey === 'object' ? (hotkey as Record<string, unknown>) : null
}

async function removePluginServiceInstances(type: string, name: string): Promise<void> {
  if (!SERVICE_PLUGIN_TYPES.includes(type)) {
    return
  }

  const serviceListKey = `${type}_service_list`
  const serviceList = getConfig(serviceListKey)
  if (!Array.isArray(serviceList)) {
    return
  }

  const retained = serviceList.filter((instanceKey) => {
    if (typeof instanceKey !== 'string') {
      return true
    }
    return instanceKey.split('@')[0] !== name
  })

  if (retained.length === serviceList.length) {
    return
  }

  await setConfig(serviceListKey, retained)
  for (const instanceKey of serviceList) {
    if (typeof instanceKey === 'string' && instanceKey.split('@')[0] === name) {
      await setConfig(instanceKey, undefined)
    }
  }
}

async function installFromZip(file: string): Promise<PluginInstallResult> {
  const zip = new AdmZip(file)
  const entries = zip.getEntries()
  const manifestEntry = entries.find((entry) => entry.entryName === 'info.json')
  const mainJsEntry = entries.find((entry) => entry.entryName === 'main.js')

  if (!manifestEntry) {
    throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Plugin package must contain info.json.')
  }

  if (!mainJsEntry) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin package must contain main.js.',
    )
  }

  const { pluginType, pluginName } = assertManifestIdentity(
    parseManifest(manifestEntry.getData().toString('utf8')),
  )
  const targetDir = path.join(pluginRoot(), pluginType, pluginName)
  const tempDir = `${targetDir}.tmp`
  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })

  try {
    for (const entry of entries) {
      if (entry.isDirectory) {
        continue
      }

      const targetPath = path.join(tempDir, entry.entryName)
      assertInside(tempDir, targetPath)
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, entry.getData())
    }

    await rm(targetDir, { recursive: true, force: true })
    await mkdir(path.dirname(targetDir), { recursive: true })
    await rename(tempDir, targetDir)

    logger.info('Plugin installed from archive.', {
      type: pluginType,
      name: pluginName,
    })

    return {
      status: 'installed',
      type: pluginType,
      name: pluginName,
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    logger.error('Plugin installation failed.', error, {
      file,
      type: pluginType,
      name: pluginName,
    })
    throw error
  }
}

async function installFromDirectory(dirPath: string): Promise<PluginInstallResult> {
  const manifestText = await readFile(path.join(dirPath, 'info.json'), 'utf8').catch(() => null)
  if (!manifestText) {
    throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Directory must contain info.json.')
  }

  const { pluginType, pluginName } = assertManifestIdentity(parseManifest(manifestText))
  const sourceMainJs = path.join(dirPath, 'main.js')
  const hasMainJs = await exists(sourceMainJs)

  if (!hasMainJs) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Directory must contain main.js.',
    )
  }

  const targetDir = path.join(pluginRoot(), pluginType, pluginName)
  const tempDir = `${targetDir}.tmp`
  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })

  try {
    await cp(dirPath, tempDir, { recursive: true })

    await rm(targetDir, { recursive: true, force: true })
    await mkdir(path.dirname(targetDir), { recursive: true })
    await rename(tempDir, targetDir)

    logger.info('Plugin installed from directory.', {
      type: pluginType,
      name: pluginName,
      source: dirPath,
    })

    return {
      status: 'installed',
      type: pluginType,
      name: pluginName,
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    logger.error('Plugin directory installation failed.', error, {
      dirPath,
      type: pluginType,
      name: pluginName,
    })
    throw error
  }
}

export async function installPlugin(file: string): Promise<PluginInstallResult> {
  return (await isDirectory(file)) ? installFromDirectory(file) : installFromZip(file)
}

function resolveLocalInstallSource(source: string): string | null {
  if (/^file:\/\//i.test(source)) {
    return fileURLToPath(source)
  }

  if (/^https?:\/\//i.test(source)) {
    return null
  }

  return path.isAbsolute(source) ? source : path.resolve(process.cwd(), source)
}

export async function installPluginFromUrl(source: string): Promise<PluginInstallResult> {
  const localSource = resolveLocalInstallSource(source)
  if (localSource) {
    return installPlugin(localSource)
  }

  const response = await fetch(source)
  if (!response.ok) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `Plugin download failed with HTTP ${response.status}.`,
    )
  }

  const tempDir = path.join(app.getPath('temp'), 'neopot-plugin-downloads')
  await mkdir(tempDir, { recursive: true })
  const tempFile = path.join(tempDir, `${Date.now()}-${path.basename(new URL(source).pathname)}`)
  await writeFile(tempFile, Buffer.from(await response.arrayBuffer()))

  try {
    return await installPlugin(tempFile)
  } finally {
    await rm(tempFile, { force: true })
  }
}

export async function uninstallPlugin(type: string, name: string): Promise<void> {
  const manifest = await readPluginManifest(type, name)
  if (manifest) {
    for (const hotkey of manifest.hotkeys) {
      if (typeof hotkey !== 'object' || hotkey === null) {
        continue
      }

      const key = (hotkey as { key?: unknown }).key
      if (typeof key !== 'string' || !key) {
        continue
      }

      const configKey = pluginHotkeyConfigKey(type, name, key)
      const shortcut = getConfig(configKey)
      if (typeof shortcut === 'string' && shortcut.trim()) {
        globalShortcut.unregister(shortcut.trim())
      }
      await setConfig(configKey, undefined)
    }
  }

  await rm(path.join(pluginRoot(), type, name), {
    recursive: true,
    force: true,
  })
  await setConfig(pluginEnabledKey(type, name), undefined)
  if (type === 'lang_detect' && getConfig('translate_detect_engine') === `plugin:${name}`) {
    await setConfig('translate_detect_engine', 'local')
  }
  await removePluginServiceInstances(type, name)
  logger.info('Plugin uninstalled.', {
    type,
    name,
  })
}

export async function setPluginEnabled(
  type: string,
  name: string,
  enabled: boolean,
): Promise<void> {
  await setConfig(pluginEnabledKey(type, name), enabled)
  const manifest = await readPluginManifest(type, name)
  if (manifest) {
    for (const hotkey of manifest.hotkeys) {
      if (typeof hotkey !== 'object' || hotkey === null) {
        continue
      }

      const key = (hotkey as { key?: unknown }).key
      if (typeof key !== 'string' || !key) {
        continue
      }

      const configKey = pluginHotkeyConfigKey(type, name, key)
      const shortcut = getConfig(configKey)
      if (typeof shortcut !== 'string' || !shortcut.trim()) {
        continue
      }

      if (enabled) {
        const { registerGlobalShortcutByName } = await import('../modules/hotkey')
        await registerGlobalShortcutByName(configKey, shortcut)
      } else {
        globalShortcut.unregister(shortcut.trim())
      }
    }
  }
  logger.info('Plugin enabled state changed.', {
    type,
    name,
    enabled,
  })
}

export async function listInstalledPlugins(type?: string): Promise<PluginInfo[]> {
  const root = pluginRoot()
  const typeEntries =
    typeof type === 'string' && type.length > 0
      ? [{ name: type, isDirectory: () => true }]
      : await readdir(root, { withFileTypes: true }).catch(() => [])

  const plugins: PluginInfo[] = []
  for (const typeEntry of typeEntries) {
    if (!typeEntry.isDirectory()) {
      continue
    }

    const pluginType = typeEntry.name
    const dir = path.join(root, pluginType)
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      const manifest = await readPluginManifest(pluginType, entry.name)
      if (manifest) {
        plugins.push(manifest)
      }
    }
  }

  return plugins
}

export async function listPlugins(type: string): Promise<PluginInfo[]> {
  return listInstalledPlugins(type)
}
