export async function unregister(shortcut: string) {
  await window.neoPot?.hotkey.unregister(shortcut)
}

export async function isRegistered(shortcut: string) {
  return (await window.neoPot?.hotkey.isRegistered(shortcut)) ?? false
}
