export async function unregisterHotkey(shortcut: string) {
  await window.neoPot.hotkey.unregister(shortcut)
}

export async function isHotkeyRegistered(shortcut: string) {
  return window.neoPot.hotkey.isRegistered(shortcut)
}
