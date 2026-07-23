export async function enableAutoStart() {
  await window.neoPot.app.setAutoStart(true)
}

export async function disableAutoStart() {
  await window.neoPot.app.setAutoStart(false)
}

export async function isAutoStartEnabled() {
  return window.neoPot.app.isAutoStartEnabled()
}
