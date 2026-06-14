function hasPluginHotkeyHandler(hotkeys: unknown): boolean {
  return (
    Array.isArray(hotkeys) &&
    hotkeys.some((hotkey) => {
      if (typeof hotkey !== 'object' || hotkey === null) {
        return false
      }

      const handler = (hotkey as Record<string, unknown>).handler
      return typeof handler === 'string' && handler.trim().length > 0
    })
  )
}

export function getCardActions(
  plugin: {
    enabled?: boolean
    homepage?: string
    options?: unknown[]
    hotkeys?: unknown[]
  } = {},
) {
  const enabled = plugin.enabled !== false

  return {
    homepage: enabled && typeof plugin.homepage === 'string' && plugin.homepage.length > 0,
    settings: enabled && Array.isArray(plugin.options) && plugin.options.length > 0,
    hotkey: enabled && hasPluginHotkeyHandler(plugin.hotkeys),
    delete: true,
    enable: true,
  }
}

export function hotkeysForPlugin<T extends { pluginId: string }>(rows: T[] = [], pluginId: string) {
  return rows.filter((row) => row.pluginId === pluginId)
}
