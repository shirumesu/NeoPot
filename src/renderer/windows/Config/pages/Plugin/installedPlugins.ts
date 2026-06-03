import { pluginApi } from '@/renderer/lib/electron/adapter'

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

async function normalizePlugin(plugin: any) {
  return {
    id: plugin.id ?? `${plugin.type}:${plugin.name}`,
    type: plugin.type ?? plugin.plugin_type,
    name: plugin.name,
    display: plugin.display ?? plugin.name,
    version: plugin.version ?? '',
    author: plugin.author ?? '',
    description: plugin.description ?? '',
    icon: await normalizePluginIcon(plugin.icon),
    enabled: plugin.enabled ?? true,
    installSource: typeof plugin.installSource === 'string' ? plugin.installSource : '',
    installSourceType:
      plugin.installSourceType === 'local' || plugin.installSourceType === 'url'
        ? plugin.installSourceType
        : '',
    needs: Array.isArray(plugin.needs) ? plugin.needs : [],
    hotkeys: Array.isArray(plugin.hotkeys) ? plugin.hotkeys : [],
    options: Array.isArray(plugin.options) ? plugin.options : [],
    homepage: plugin.homepage ?? '',
    language: plugin.language ?? {},
  }
}

export type InstalledPlugin = Awaited<ReturnType<typeof normalizePlugin>>
export type EnabledServicePluginList = Record<string, Record<string, InstalledPlugin>>

export async function loadInstalledPlugins(type?: string) {
  if (!pluginApi?.listInstalled) {
    return []
  }

  const plugins = await pluginApi.listInstalled(type)
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
