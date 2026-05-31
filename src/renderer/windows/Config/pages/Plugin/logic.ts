export function getCardActions(plugin: any = {}) {
  return {
    settings: Array.isArray(plugin.options) && plugin.options.length > 0,
    hotkey: Array.isArray(plugin.hotkeys) && plugin.hotkeys.length > 0,
    delete: true,
    enable: true,
  }
}

export function hotkeysForPlugin(rows: any[] = [], pluginId: string) {
  return rows.filter((row) => row.pluginId === pluginId)
}
