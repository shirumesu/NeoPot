export async function enable() {
  await window.neoPot?.app.setAutoStart(true)
}

export async function disable() {
  await window.neoPot?.app.setAutoStart(false)
}

export async function isEnabled() {
  return (await window.neoPot?.app.isAutoStartEnabled()) ?? false
}
