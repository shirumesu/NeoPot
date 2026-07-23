import type { PluginInfo } from '@/shared/types/electron-api'

const servicePluginTypes = ['translate', 'recognize', 'tts']
const defaultPluginIcon = 'logo/plugin.svg'

function mimeTypeFromPath(filePath: string) {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.svg')) {
    return 'image/svg+xml'
  }
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (lowerPath.endsWith('.webp')) {
    return 'image/webp'
  }
  return 'image/png'
}

function isLocalIconPath(icon: string) {
  return (
    /^file:\/\//i.test(icon) ||
    /^[a-zA-Z]:[\\/]/.test(icon) ||
    /^\\\\/.test(icon) ||
    icon.startsWith('/')
  )
}

function fileUrlToPath(icon: string) {
  if (!/^file:\/\//i.test(icon)) {
    return icon
  }

  const url = new URL(icon)
  const pathname = decodeURIComponent(url.pathname)
  return /^[a-zA-Z]:/.test(pathname.slice(1)) ? pathname.slice(1) : pathname
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key]
  return typeof value === 'string' ? value : fallback
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

function readLanguageMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

async function normalizePluginIcon(icon: unknown) {
  const iconSource = typeof icon === 'string' && icon.trim() ? icon.trim() : defaultPluginIcon
  if (!isLocalIconPath(iconSource)) {
    return iconSource
  }

  const filePath = fileUrlToPath(iconSource)
  try {
    const bytes = await window.neoPot.fs.readFile(filePath)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.slice(index, index + 8192))
    }
    return `data:${mimeTypeFromPath(filePath)};base64,${btoa(binary)}`
  } catch {
    return defaultPluginIcon
  }
}

async function normalizePlugin(plugin: PluginInfo) {
  const record = isRecord(plugin) ? plugin : {}
  const type = readString(record, 'type', readString(record, 'plugin_type'))
  const name = readString(record, 'name')

  return {
    id: readString(record, 'id', `${type}:${name}`),
    type,
    name,
    display: readString(record, 'display', name),
    version: readString(record, 'version'),
    author: readString(record, 'author'),
    description: readString(record, 'description'),
    icon: await normalizePluginIcon(record.icon),
    enabled: record.enabled !== false,
    installSource: readString(record, 'installSource'),
    installSourceType:
      record.installSourceType === 'local' || record.installSourceType === 'url'
        ? record.installSourceType
        : '',
    needs: readArray(record, 'needs'),
    hotkeys: readArray(record, 'hotkeys'),
    options: readArray(record, 'options'),
    homepage: readString(record, 'homepage'),
    language: readLanguageMap(record.language),
  }
}

export type InstalledPlugin = Awaited<ReturnType<typeof normalizePlugin>>
export type EnabledServicePluginList = Record<string, Record<string, InstalledPlugin>>

export async function loadInstalledPlugins(type?: string) {
  const plugins = await window.neoPot.plugins.listInstalled(type)
  return Promise.all(plugins.map(normalizePlugin))
}

export async function loadEnabledServicePlugins() {
  const plugins = (await loadInstalledPlugins()).filter(
    (plugin) => plugin.enabled && servicePluginTypes.includes(plugin.type),
  )

  return servicePluginTypes.reduce<EnabledServicePluginList>((grouped, type) => {
    grouped[type] = {}
    for (const plugin of plugins) {
      if (plugin.type === type) {
        grouped[type][plugin.name] = plugin
      }
    }
    return grouped
  }, {})
}
