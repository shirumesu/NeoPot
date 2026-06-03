export function getCardActions(plugin: any = {}) {
  const enabled = plugin.enabled !== false

  return {
    homepage: enabled && typeof plugin.homepage === 'string' && plugin.homepage.length > 0,
    settings: enabled && Array.isArray(plugin.options) && plugin.options.length > 0,
    hotkey: enabled && Array.isArray(plugin.hotkeys) && plugin.hotkeys.length > 0,
    delete: true,
    enable: true,
  }
}

export function hotkeysForPlugin(rows: any[] = [], pluginId: string) {
  return rows.filter((row) => row.pluginId === pluginId)
}
