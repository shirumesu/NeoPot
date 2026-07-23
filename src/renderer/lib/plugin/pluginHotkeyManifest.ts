export interface PluginManifestHotkey {
  key: string
  display: string
  default: string
  handler: string
}

export interface PluginHotkeyRow {
  pluginId: string
  pluginType: string
  pluginName: string
  pluginDisplay: string
  key: string
  display: string
  hotkey: string
}

interface PluginWithHotkeys {
  id: string
  type: string
  name: string
  display: string
  hotkeys: unknown
}

export function isPluginManifestHotkey(value: unknown): value is PluginManifestHotkey {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.display === 'string' &&
    typeof candidate.default === 'string' &&
    typeof candidate.handler === 'string' &&
    candidate.handler.trim().length > 0
  )
}

export function createPluginHotkeyRows(plugin: PluginWithHotkeys): PluginHotkeyRow[] {
  const hotkeys = Array.isArray(plugin.hotkeys) ? plugin.hotkeys : []

  return hotkeys.filter(isPluginManifestHotkey).map((hotkey) => ({
    pluginId: plugin.id,
    pluginType: plugin.type,
    pluginName: plugin.name,
    pluginDisplay: plugin.display,
    key: hotkey.key,
    display: hotkey.display,
    hotkey: hotkey.default,
  }))
}
