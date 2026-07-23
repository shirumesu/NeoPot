export function onAppEvent(event: string, handler: (payload: unknown) => void) {
  return window.neoPot.app.onEvent(event, handler)
}

export async function emitAppEvent(event: string, payload?: unknown) {
  await window.neoPot.app.emit(event, payload)
}
