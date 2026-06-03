import { app } from 'electron'
import AdmZip from 'adm-zip'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
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
    readonly code: 'PLUGIN_INVALID_EXTENSION' | 'PLUGIN_INVALID_PACKAGE' | 'PLUGIN_ZIP_SLIP',
    message: string,
  ) {
    super(message)
    this.name = 'PluginInstallError'
  }
}

function pluginRoot(): string {
  return path.join(app.getPath('userData'), 'plugins')
}

function pluginEnabledKey(type: string, name: string): string {
  return `plugin:${type}:${name}:enabled`
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

function assertNpotPackage(file: string): void {
  if (path.extname(file).toLowerCase() !== '.npot') {
    throw new PluginInstallError(
      'PLUGIN_INVALID_EXTENSION',
      'Plugin package must use the .npot extension.',
    )
  }
}

function getPluginEnabled(type: string, name: string): boolean {
  const stored = getConfig(pluginEnabledKey(type, name))
  return typeof stored === 'boolean' ? stored : true
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

export async function installPlugin(file: string): Promise<PluginInstallResult> {
  assertNpotPackage(file)

  const zip = new AdmZip(file)
  const entries = zip.getEntries()
  const manifestEntry = entries.find((entry) => entry.entryName === 'info.json')
  const mainEntry = entries.find((entry) => entry.entryName === 'main.js')

  if (!manifestEntry || !mainEntry) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin package must contain info.json and main.js.',
    )
  }

  const manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as {
    plugin_type?: string
    name?: string
  }
  const pluginType = manifest.plugin_type
  const pluginName = manifest.name
  if (!pluginType || !pluginName) {
    throw new PluginInstallError(
      'PLUGIN_INVALID_PACKAGE',
      'Plugin manifest is missing plugin_type or name.',
    )
  }

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
    await import('node:fs/promises').then(({ rename }) => rename(tempDir, targetDir))

    logger.info('Plugin installed.', {
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

export async function uninstallPlugin(type: string, name: string): Promise<void> {
  await rm(path.join(pluginRoot(), type, name), {
    recursive: true,
    force: true,
  })
  await setConfig(pluginEnabledKey(type, name), undefined)
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
