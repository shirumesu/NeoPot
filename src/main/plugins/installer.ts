import { app, globalShortcut } from 'electron'
import AdmZip from 'adm-zip'
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfig, setConfig } from '../modules/config'
import { logger } from '../logger'

const SERVICE_PLUGIN_TYPES = ['translate', 'recognize', 'tts']
const PLUGIN_METADATA_FILE = '.neopot-plugin.json'
const DEFAULT_PLUGIN_ICON = 'logo/plugin.svg'
const PLUGIN_ID_PATTERN = /^[a-z0-9_-]+$/

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
  const comparisonParent = process.platform === 'win32' ? parentPath.toLowerCase() : parentPath
  const comparisonChild = process.platform === 'win32' ? childPath.toLowerCase() : childPath
  if (
    comparisonChild !== comparisonParent &&
    !comparisonChild.startsWith(comparisonParent + path.sep)
  ) {
    throw new PluginInstallError(
      'PLUGIN_ZIP_SLIP',
      'Plugin package contains an unsafe extraction path.',
    )
  }
}

function isValidPluginIdentityPart(value: string): boolean {
  return PLUGIN_ID_PATTERN.test(value)
}

export function assertValidPluginIdentity(
  type: string,
  name: string,
): {
  type: string
  name: string
} {
  if (!isValidPluginIdentityPart(type) || !isValidPluginIdentityPart(name)) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin type and name may contain only lowercase letters, numbers, underscores, and hyphens.',
    )
  }

  return { type, name }
}

export function installedPluginDir(type: string, name: string): string {
  const identity = assertValidPluginIdentity(type, name)
  const root = pluginRoot()
  const pluginDir = path.resolve(root, identity.type, identity.name)
  assertInside(root, pluginDir)
  return pluginDir
}

function pluginTempDir(type: string, name: string): string {
  const root = pluginRoot()
  const tempDir = `${installedPluginDir(type, name)}.tmp`
  assertInside(root, tempDir)
  return tempDir
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

async function writeInstallMetadata(
  targetDir: string,
  source: string,
  sourceType: 'local' | 'url',
): Promise<void> {
  await writeFile(
    path.join(targetDir, PLUGIN_METADATA_FILE),
    JSON.stringify(
      {
        installSource: source,
        installSourceType: sourceType,
        installedAt: Date.now(),
      } satisfies PluginInstallMetadata,
      null,
      2,
    ),
    'utf8',
  )
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

  const identity = assertValidPluginIdentity(pluginType, pluginName)
  return { pluginType: identity.type, pluginName: identity.name }
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
    throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Plugin package must contain main.js.')
  }

  const { pluginType, pluginName } = assertManifestIdentity(
    parseManifest(manifestEntry.getData().toString('utf8')),
  )
  const targetDir = installedPluginDir(pluginType, pluginName)
  const tempDir = pluginTempDir(pluginType, pluginName)
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
    throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Directory must contain main.js.')
  }

  const targetDir = installedPluginDir(pluginType, pluginName)
  const tempDir = pluginTempDir(pluginType, pluginName)
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
  const normalizedSource = path.resolve(file)
  const result = (await isDirectory(normalizedSource))
    ? await installFromDirectory(normalizedSource)
    : await installFromZip(normalizedSource)
  await writeInstallMetadata(
    installedPluginDir(result.type, result.name),
    normalizedSource,
    'local',
  )
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
    const result = await installFromZip(tempFile)
    await writeInstallMetadata(installedPluginDir(result.type, result.name), source, 'url')
    await registerPluginDefaultHotkeys(result.type, result.name)
    return result
  } finally {
    await rm(tempFile, { force: true })
  }
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

  const zip = new AdmZip(localSource)
  const manifestEntry = zip.getEntries().find((entry) => entry.entryName === 'info.json')
  if (!manifestEntry) {
    throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Plugin package must contain info.json.')
  }

  return parseManifest(manifestEntry.getData().toString('utf8')) as PluginSourceManifest
}

async function readManifestFromHttpSource(source: string): Promise<PluginSourceManifest> {
  const response = await fetch(source)
  if (!response.ok) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      `Plugin manifest check failed with HTTP ${response.status}.`,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (/json/i.test(contentType) || /\.json(?:[?#]|$)/i.test(source)) {
    return parseManifest(await response.text()) as PluginSourceManifest
  }

  const tempDir = path.join(app.getPath('temp'), 'neopot-plugin-update-checks')
  await mkdir(tempDir, { recursive: true })
  const tempFile = path.join(tempDir, `${Date.now()}-${path.basename(new URL(source).pathname)}`)
  await writeFile(tempFile, Buffer.from(await response.arrayBuffer()))

  try {
    return readManifestFromLocalSource(tempFile)
  } finally {
    await rm(tempFile, { force: true })
  }
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
    if (typeof hotkey !== 'object' || hotkey === null) {
      continue
    }

    const key = (hotkey as { key?: unknown }).key
    if (typeof key !== 'string' || !key) {
      continue
    }

    const configKey = pluginHotkeyConfigKey(type, name, key)
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
      if (typeof hotkey !== 'object' || hotkey === null) {
        continue
      }

      const key = (hotkey as { key?: unknown }).key
      if (typeof key !== 'string' || !key) {
        continue
      }

      const configKey = pluginHotkeyConfigKey(type, name, key)
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
