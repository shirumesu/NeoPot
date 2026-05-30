import { pluginApi } from '@/utils/electron_adapter'

const servicePluginTypes = ['translate', 'recognize', 'tts']

function normalizePlugin(plugin) {
  return {
    id: plugin.id ?? `${plugin.type}:${plugin.name}`,
    type: plugin.type ?? plugin.plugin_type,
    name: plugin.name,
    display: plugin.display ?? plugin.name,
    version: plugin.version ?? '',
    author: plugin.author ?? '',
    description: plugin.description ?? '',
    icon: plugin.icon ?? '',
    enabled: plugin.enabled ?? true,
    needs: Array.isArray(plugin.needs) ? plugin.needs : [],
    hotkeys: Array.isArray(plugin.hotkeys) ? plugin.hotkeys : [],
    options: Array.isArray(plugin.options) ? plugin.options : [],
    homepage: plugin.homepage ?? '',
    language: plugin.language ?? {},
  }
}

export async function loadInstalledPlugins(type) {
  if (!pluginApi?.listInstalled) {
    return []
  }

  const plugins = await pluginApi.listInstalled(type)
  return plugins.map(normalizePlugin)
}

export async function loadEnabledServicePlugins() {
  const plugins = (await loadInstalledPlugins()).filter(
    (plugin) => plugin.enabled && servicePluginTypes.includes(plugin.type),
  )

  return servicePluginTypes.reduce((grouped, type) => {
    grouped[type] = {}
    for (const plugin of plugins) {
      if (plugin.type === type) {
        grouped[type][plugin.name] = plugin
      }
    }
    return grouped
  }, {})
}
