import { app, globalShortcut } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfig, setConfig } from '../modules/config'
import { logger } from '../logger'
import { isServiceInstanceForPlugin } from '../../shared/serviceInstance'
import {
  PLUGIN_METADATA_FILE,
  PluginInstallError,
  assertValidPluginIdentity as assertValidPluginIdentityCore,
  createPluginInstallerCore,
  isValidPluginIdentityPart as isValidPluginIdentityPartCore,
  parsePluginManifest,
  readPluginManifestFromZip,
  resolveInstalledPluginDir,
} from './pluginInstallerCore'
import {
  REMOTE_PLUGIN_MAX_COMPRESSED_BYTES,
  REMOTE_PLUGIN_MAX_MANIFEST_BYTES,
  downloadRemotePluginFile,
  fetchRemotePluginResource,
  readRemotePluginResponse,
  streamRemotePluginResponseToFile,
} from './remoteDownload'

const SERVICE_PLUGIN_TYPES = ['translate', 'recognize', 'tts']
const DEFAULT_PLUGIN_ICON = 'logo/plugin.svg'

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
  installSource: string
  installSourceType: 'local' | 'url' | ''
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

export interface PluginSourceManifest {
  plugin_type?: string
  name?: string
  display?: string
  version?: string
  author?: string
  description?: string
  homepage?: string
  icon?: string
}

interface PluginInstallMetadata {
  installSource?: string
  installSourceType?: 'local' | 'url'
  installedAt?: number
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

function isValidPluginIdentityPart(value: string): boolean {
  return isValidPluginIdentityPartCore(value)
}

export function assertValidPluginIdentity(
  type: string,
  name: string,
): {
  type: string
  name: string
} {
  return assertValidPluginIdentityCore(type, name)
}

export function installedPluginDir(type: string, name: string): string {
  return resolveInstalledPluginDir(pluginRoot(), type, name)
}

function getPluginEnabled(type: string, name: string): boolean {
  const stored = getConfig(pluginEnabledKey(type, name))
  return typeof stored === 'boolean' ? stored : true
}

function normalizeManifestIcon(pluginDir: string, icon: unknown): string {
  if (typeof icon !== 'string' || !icon.trim()) {
    return DEFAULT_PLUGIN_ICON
  }

  const value = icon.trim()
  if (/^(https?:|file:|data:)/i.test(value)) {
    return value
  }

  return path.join(pluginDir, value)
}

async function isDirectory(filePath: string): Promise<boolean> {
  return stat(filePath)
    .then((stats) => stats.isDirectory())
    .catch(() => false)
}

function parseManifest(text: string): { plugin_type?: string; name?: string } {
  return parsePluginManifest(text)
}

async function readInstallMetadata(pluginDir: string): Promise<PluginInstallMetadata> {
  const text = await readFile(path.join(pluginDir, PLUGIN_METADATA_FILE), 'utf8').catch(() => null)
  if (!text) {
    return {}
  }

  try {
    const metadata = JSON.parse(text) as PluginInstallMetadata
    return metadata && typeof metadata === 'object' ? metadata : {}
  } catch {
    return {}
  }
}

async function readPluginManifest(type: string, name: string): Promise<PluginInfo | null> {
  const pluginDir = installedPluginDir(type, name)
  const manifestPath = path.join(pluginDir, 'info.json')
  const manifestText = await readFile(manifestPath, 'utf8').catch(() => null)
  if (!manifestText) {
    return null
  }

  const manifest = JSON.parse(manifestText) as Record<string, unknown>
  const metadata = await readInstallMetadata(pluginDir)
  const display = typeof manifest.display === 'string' ? manifest.display : name
  const icon = normalizeManifestIcon(pluginDir, manifest.icon)

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
    installSource: typeof metadata.installSource === 'string' ? metadata.installSource : '',
    installSourceType:
      metadata.installSourceType === 'local' || metadata.installSourceType === 'url'
        ? metadata.installSourceType
        : '',
    needs: Array.isArray(manifest.needs) ? manifest.needs : [],
    options: Array.isArray(manifest.options) ? manifest.options : [],
    hotkeys: Array.isArray(manifest.hotkeys) ? manifest.hotkeys : [],
  }
}

function getHotkeyDefault(hotkey: Record<string, unknown>): string {
  return typeof hotkey.default === 'string' ? hotkey.default.trim() : ''
}

function isPluginHotkeyWithHandler(hotkey: unknown): hotkey is Record<string, unknown> & {
  key: string
  handler: string
} {
  if (typeof hotkey !== 'object' || hotkey === null) {
    return false
  }

  const hotkeyRecord = hotkey as Record<string, unknown>
  return (
    typeof hotkeyRecord.key === 'string' &&
    hotkeyRecord.key.length > 0 &&
    typeof hotkeyRecord.handler === 'string' &&
    hotkeyRecord.handler.trim().length > 0
  )
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
    return isPluginHotkeyWithHandler(item) && item.key === key
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
    return !isServiceInstanceForPlugin(instanceKey, name)
  })

  if (retained.length === serviceList.length) {
    return
  }

  await setConfig(serviceListKey, retained)
  for (const instanceKey of serviceList) {
    if (typeof instanceKey === 'string' && isServiceInstanceForPlugin(instanceKey, name)) {
      await setConfig(instanceKey, undefined)
    }
  }
}

export async function installPlugin(file: string): Promise<PluginInstallResult> {
  const normalizedSource = path.resolve(file)
  const installer = createPluginInstallerCore({ pluginRoot: pluginRoot() })
  const installSource = {
    installSource: normalizedSource,
    installSourceType: 'local' as const,
  }
  const result = (await isDirectory(normalizedSource))
    ? await installer.installFromDirectory(normalizedSource, installSource)
    : await installer.installFromZip(normalizedSource, installSource)

  logger.info('Plugin installed from local source.', {
    type: result.type,
    name: result.name,
    source: normalizedSource,
  })
  await registerPluginDefaultHotkeys(result.type, result.name)
  return result
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

  const tempDir = path.join(app.getPath('temp'), 'neopot-plugin-downloads')
  await mkdir(tempDir, { recursive: true })
  const tempFile = temporaryRemotePluginFile(tempDir, source)

  try {
    await downloadRemotePluginFile(source, tempFile)
    const installer = createPluginInstallerCore({ pluginRoot: pluginRoot() })
    const result = await installer.installFromZip(tempFile, {
      installSource: source,
      installSourceType: 'url',
    })
    logger.info('Plugin installed from URL.', {
      type: result.type,
      name: result.name,
      source,
    })
    await registerPluginDefaultHotkeys(result.type, result.name)
    return result
  } finally {
    await rm(tempFile, { force: true })
  }
}

function temporaryRemotePluginFile(tempDir: string, source: string): string {
  const sourceName = path.basename(new URL(source).pathname) || 'plugin.zip'
  const safeName = sourceName.replace(/[^a-z0-9._-]/gi, '_').slice(-120)
  return path.join(tempDir, `${randomUUID()}-${safeName}`)
}

async function readManifestFromLocalSource(source: string): Promise<PluginSourceManifest> {
  const localSource = resolveLocalInstallSource(source)
  if (!localSource) {
    throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Expected a local plugin source.')
  }

  if (await isDirectory(localSource)) {
    const text = await readFile(path.join(localSource, 'info.json'), 'utf8')
    return parseManifest(text) as PluginSourceManifest
  }

  if (path.basename(localSource).toLowerCase() === 'info.json') {
    return parseManifest(await readFile(localSource, 'utf8')) as PluginSourceManifest
  }

  return readPluginManifestFromZip(localSource) as PluginSourceManifest
}

async function readManifestFromHttpSource(source: string): Promise<PluginSourceManifest> {
  return fetchRemotePluginResource(
    source,
    async (response) => {
      const contentType = response.headers.get('content-type') ?? ''
      if (/json/i.test(contentType) || /\.json(?:[?#]|$)/i.test(source)) {
        const manifest = await readRemotePluginResponse(
          response,
          REMOTE_PLUGIN_MAX_MANIFEST_BYTES,
          'Plugin manifest check',
        )
        return parseManifest(manifest.toString('utf8')) as PluginSourceManifest
      }

      const tempDir = path.join(app.getPath('temp'), 'neopot-plugin-update-checks')
      await mkdir(tempDir, { recursive: true })
      const tempFile = temporaryRemotePluginFile(tempDir, source)
      try {
        await streamRemotePluginResponseToFile(
          response,
          tempFile,
          REMOTE_PLUGIN_MAX_COMPRESSED_BYTES,
          'Plugin manifest archive download',
        )
        return readManifestFromLocalSource(tempFile)
      } finally {
        await rm(tempFile, { force: true })
      }
    },
    { operation: 'Plugin manifest check' },
  )
}

export async function readPluginManifestFromSource(source: string): Promise<PluginSourceManifest> {
  return /^https?:\/\//i.test(source)
    ? readManifestFromHttpSource(source)
    : readManifestFromLocalSource(source)
}

async function registerPluginDefaultHotkeys(type: string, name: string): Promise<void> {
  const manifest = await readPluginManifest(type, name)
  if (!manifest?.enabled) {
    return
  }

  const { registerGlobalShortcutByName } = await import('../modules/hotkey')
  for (const hotkey of manifest.hotkeys) {
    if (!isPluginHotkeyWithHandler(hotkey)) {
      continue
    }

    const configKey = pluginHotkeyConfigKey(type, name, hotkey.key)
    const stored = getConfig(configKey)
    if (stored !== undefined) {
      continue
    }

    const defaultShortcut = getHotkeyDefault(hotkey as Record<string, unknown>)
    if (defaultShortcut) {
      await registerGlobalShortcutByName(configKey, defaultShortcut)
    }
  }
}

export async function uninstallPlugin(type: string, name: string): Promise<void> {
  const manifest = await readPluginManifest(type, name)
  if (manifest) {
    for (const hotkey of manifest.hotkeys) {
      if (!isPluginHotkeyWithHandler(hotkey)) {
        continue
      }

      const configKey = pluginHotkeyConfigKey(type, name, hotkey.key)
      const shortcut = getConfig(configKey)
      if (typeof shortcut === 'string' && shortcut.trim()) {
        globalShortcut.unregister(shortcut.trim())
      }
      await setConfig(configKey, undefined)
    }
  }

  await rm(installedPluginDir(type, name), {
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
      if (!isPluginHotkeyWithHandler(hotkey)) {
        continue
      }

      const configKey = pluginHotkeyConfigKey(type, name, hotkey.key)
      const storedShortcut = getConfig(configKey)
      const shortcut =
        typeof storedShortcut === 'string'
          ? storedShortcut.trim()
          : getHotkeyDefault(hotkey as Record<string, unknown>)
      if (!shortcut) {
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
    if (!isValidPluginIdentityPart(pluginType)) {
      continue
    }
    const dir = path.join(root, pluginType)
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      if (!isValidPluginIdentityPart(entry.name)) {
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
